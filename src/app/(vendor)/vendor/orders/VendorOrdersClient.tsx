'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeading } from '@/components/vendor/Workspace'
import {
  Package,
  PackageCheck,
  Truck,
  ShieldAlert,
  Clock,
  ChevronRight,
  MapPin,
  Phone,
  FileText,
  Loader2,
  Inbox,
  Search,
  KeyRound,
} from 'lucide-react'
import { nextDeliveryStep } from '@/lib/orders/tracking'
import OrderRefresh from '@/components/orders/OrderRefresh'
import DeliveryCodeEntry from '@/components/orders/DeliveryCodeEntry'
import { createClient } from '@/lib/supabase/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

type Tab = 'todo' | 'awaiting' | 'completed' | 'disputed'

const STEPS = ['pending', 'confirmed', 'shipped', 'delivered'] as const

// Different tables may name a field differently, so we take the first one that exists
const pick = (obj: Row | undefined, keys: string[]) => {
  if (!obj) return undefined
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  return undefined
}

const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG')

const fmtDate = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

const itemSubtotal = (i: Row) =>
  Number(pick(i, ['subtotal', 'total_price']) ?? Number(pick(i, ['unit_price', 'price']) ?? 0) * Number(i.quantity ?? 1))

function groupTab(items: Row[]): Tab {
  const s = items.map((i) => i.fulfillment_status)
  if (s.includes('disputed')) return 'disputed'
  if (s.some((x) => ['pending', 'confirmed', 'shipped'].includes(x))) return 'todo'
  if (items.some(i => ['delivered', 'received'].includes(i.fulfillment_status) && !i.released_at)) return 'awaiting'
  return 'completed'
}

export default function VendorOrdersClient({
  items: initialItems,
  orders,
  products,
}: {
  items: Row[]
  orders: Row[]
  products: Row[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const items = initialItems
  const router = useRouter()
  const [refreshing, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('todo')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [codeItemId, setCodeItemId] = useState<string|null>(null)
  const [codeReported, setCodeReported] = useState(false)

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  // One card per order, holding only THIS vendor's items from that order
  const groups = useMemo(() => {
    const byOrder = new Map<string, Row[]>()
    for (const it of items) {
      const list = byOrder.get(it.order_id) ?? []
      list.push(it)
      byOrder.set(it.order_id, list)
    }
    return orders
      .filter((o) => byOrder.has(o.id))
      .map((o) => {
        const its = byOrder.get(o.id)!
        return { order: o, items: its, tab: groupTab(its) }
      })
      .sort((a, b) => +new Date(b.order.created_at) - +new Date(a.order.created_at))
  }, [items, orders])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { todo: 0, awaiting: 0, completed: 0, disputed: 0 }
    groups.forEach((g) => c[g.tab]++)
    return c
  }, [groups])

  const canEnterCode = (item: Row) => ['shipped','delivered','received'].includes(item.fulfillment_status) && !item.released_at
  const visible = groups.filter(g => (g.tab === tab || g.items.some(i=>i.id===codeItemId&&canEnterCode(i))) && (!query.trim() || `${g.order.id} ${g.items.map(i => productById.get(i.product_id)?.title ?? '').join(' ')}`.toLowerCase().includes(query.trim().replace(/^#/, '').toLowerCase())))

  function revealCode(item: Row, status: string, reported: boolean) {
    setCodeItemId(item.id);setCodeReported(reported)
    setTab(groupTab(items.filter(i=>i.order_id===item.order_id).map(i=>i.id===item.id?{...i,fulfillment_status:status}:i)))
  }

  async function advance(item: Row, to: string) {
    if (busyId || refreshing) return
    setBusyId(item.id)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('cm_vendor_update_delivery', { p_item_id: item.id, p_status: to })
      if (rpcError) { setError(rpcError.message); return }
      if(to==='delivered')revealCode(item,to,true)
      startTransition(() => router.refresh())
    } catch { setError('The order could not be updated. Check your connection and try again.') }
    finally { setBusyId(null) }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'todo', label: 'To do' },
    { key: 'awaiting', label: 'Delivery review' },
    { key: 'completed', label: 'Completed' },
    { key: 'disputed', label: 'Disputed' },
  ]

  return (
    <div className="vo-page">


      <PageHeading eyebrow="From your store to their door" title="Your orders" description="A clear next step for every order. Confirm, prepare, and deliver." actions={<><OrderRefresh /><Link className="vx-btn vx-btn-secondary" href="/vendor/guide">Order &amp; payout guide</Link></>} />
      <div className="vx-listing-summary" aria-label="Order summary"><div className="vx-summary-item"><span>Need your attention</span><strong>{counts.todo}</strong></div><div className="vx-summary-item"><span>Awaiting approval</span><strong>{counts.awaiting}</strong></div><div className="vx-summary-item"><span>Completed orders</span><strong>{counts.completed}</strong></div></div>
      <label className="vx-search vx-order-search"><Search size={15} /><input aria-label="Search orders" placeholder="Search order number or product…" value={query} onChange={e => setQuery(e.target.value)} type="search" /></label>

      <div className="vo-tabs" role="tablist" aria-label="Order status">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`vo-tab ${tab === t.key ? 'is-active' : ''} ${t.key === 'disputed' && counts.disputed ? 'is-alert' : ''}`}
            onClick={() => {setTab(t.key);setCodeItemId(null);setCodeReported(false)}}
          >
            {t.label}
            <span className="vo-count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="vo-error" role="alert">
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="vo-empty">
          <Inbox size={28} strokeWidth={1.5} aria-hidden />
          <h2>{query.trim() ? 'No matching orders' : tab === 'todo' ? 'You’re all caught up' : 'Nothing here yet'}</h2>
          <p>{query.trim() ? 'Try another order number or product name.' : 'Orders in this stage will show up as soon as they arrive.'}</p>
        </div>
      ) : (
        <div className="vo-list">
          {visible.map(({ order, items: its, tab: gTab }) => {
            const ref = String(order.id).slice(0, 8).toUpperCase()
            const phone = pick(order, ['phone_number', 'phone', 'buyer_phone', 'delivery_phone', 'contact_phone'])
            const method = pick(order, ['delivery_method', 'fulfillment_method', 'delivery_type'])
            const address = pick(order, ['delivery_address', 'address', 'shipping_address'])
            return (
              <article key={order.id} className={`vo-card ${gTab === 'disputed' ? 'is-disputed' : ''}`}>
                {order.payment_environment==='test'&&<p className="buyer-notice">PAYSTACK TEST ? Do not fulfil as a real sale. No real funds or vendor wallet credit.</p>}{order.is_trial&&<div className="vo-flag">TRIAL ORDER · No payment collected. Delivery and credit approval are simulated.</div>}
                {gTab === 'disputed' && (
                  <div className="vo-flag">
                    <ShieldAlert size={18} aria-hidden />
                    <span>Disputed. Payout is frozen while this is reviewed.</span>
                  </div>
                )}

                <div className="vo-card-top">
                  <div>
                    <span className="vo-ref">Order #{ref}</span>
                    <span className="vo-date">{fmtDate(order.created_at)}</span>
                  </div>
                  <div className="vo-actions">
                    <Link href={`/vendor/orders/${order.id}/slip`} className="vo-btn-ghost">
                      <FileText size={15} aria-hidden /> Packing slip
                    </Link>
                    <Link href={`/vendor/orders/${order.id}`} className="vo-btn-ghost">
                      Details <ChevronRight size={15} aria-hidden />
                    </Link>
                  </div>
                </div>

                <ul className="vo-items">
                  {its.map((it) => {
                    const p = productById.get(it.product_id)
                    const img = Array.isArray(p?.images) ? p?.images[0] : pick(p, ['image_url', 'image'])
                    const sub = itemSubtotal(it)
                    const payout = Number(it.payout_amount ?? sub * 0.95)
                    const status: string = it.fulfillment_status
                    const step = nextDeliveryStep[status]
                    const stepIndex = STEPS.indexOf(status as (typeof STEPS)[number])
                    const busy = busyId !== null || refreshing
                    return (
                      <li key={it.id} className="vo-item">
                        <div className="vo-thumb">
                          {img ? <img src={img} alt="" /> : <Package size={20} strokeWidth={1.5} aria-hidden />}
                        </div>

                        <div className="vo-item-main">
                          <h3>{p?.title ?? 'Product'}</h3>
                          <p className="vo-meta">
                            Qty {it.quantity} · {naira(sub)} · {status==='cancelled'?'Cancelled · no earnings':<>You receive <strong>{naira(payout)}</strong></>}
                          </p>

                          {status === 'cancelled' ? <p className="vo-reason">The buyer cancelled this order. Do not prepare or dispatch it.</p> : status === 'disputed' ? (
                            <p className="vo-reason">
                              Reason given: {it.dispute_reason || 'No reason provided'}
                            </p>
                          ) : (
                            <ol className="vo-steps" aria-label="Progress">
                              {STEPS.map((s, idx) => (
                                <li key={s} className={idx <= stepIndex ? 'done' : ''}>
                                  {s}
                                </li>
                              ))}
                            </ol>
                          )}

                          {['delivered', 'received'].includes(status) && !it.released_at && (
                            <p className="vo-release"><Clock size={14} aria-hidden />Vendor credit is held until delivery is verified and admin approves it. Use Delivery code to verify the handover here.</p>
                          )}
                          {it.released_at && <p className="vo-release ok"><PackageCheck size={14} aria-hidden />{(order.is_trial||order.payment_environment==='test')?'Test completed. Real wallet unchanged.':'Vendor wallet credited.'}</p>}
                        </div>

                        <div className="vo-item-side">
                          {step ? (
                            <button className="vo-btn" disabled={busy} onClick={() => advance(it, step.to)}>
                              {busy ? <Loader2 size={15} className="vo-spin" aria-hidden /> : <Truck size={15} aria-hidden />}
                              {method === 'pickup' && status === 'confirmed' ? 'Mark ready for pickup' : step.label}
                            </button>
                          ) : (
                            <span className={`vo-badge ${status}`}>{status}</span>
                          )}
                          {canEnterCode(it)&&<button className="vo-btn-ghost" disabled={busy} aria-expanded={codeItemId===it.id} aria-controls={`delivery-code-${it.id}`} onClick={()=>{setCodeItemId(codeItemId===it.id?null:it.id);setCodeReported(false)}}><KeyRound size={15} aria-hidden />Delivery code</button>}
                        </div>
                        {canEnterCode(it)&&codeItemId===it.id&&<div className="vo-code-panel" id={`delivery-code-${it.id}`}><DeliveryCodeEntry itemId={it.id} orderId={order.id} focusSignal={1} reported={codeReported} disabled={busyId!==null||refreshing} onBusyChange={working=>setBusyId(working?it.id:null)} onVerified={()=>revealCode(it,status==='shipped'?'delivered':status,false)}/></div>}
                      </li>
                    )
                  })}
                </ul>

                <footer className="vo-foot">
                  {method && <span><MapPin size={14} aria-hidden /> {String(method)}{address ? `, ${address}` : ''}</span>}
                  {phone && <span><Phone size={14} aria-hidden /> {String(phone)}</span>}
                </footer>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
