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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

type Tab = 'todo' | 'awaiting' | 'completed' | 'disputed'

const NEXT_STEP: Record<string, { to: string; label: string }> = {
  pending: { to: 'confirmed', label: 'Confirm order' },
  confirmed: { to: 'shipped', label: 'Mark as shipped' },
  shipped: { to: 'delivered', label: 'Mark as delivered' },
}

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
  if (s.includes('delivered')) return 'awaiting'
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

  const visible = groups.filter(g => g.tab === tab && (!query.trim() || `${g.order.id} ${g.items.map(i => productById.get(i.product_id)?.title ?? '').join(' ')}`.toLowerCase().includes(query.trim().replace(/^#/, '').toLowerCase())))

  async function advance(item: Row, to: string) {
    if (busyId || refreshing) return
    setBusyId(item.id)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('vendor_update_item_status', { p_item_id: item.id, p_new_status: to })
      if (rpcError) { setError(rpcError.message); return }
      startTransition(() => router.refresh())
    } catch { setError('The order could not be updated. Check your connection and try again.') }
    finally { setBusyId(null) }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'todo', label: 'To do' },
    { key: 'awaiting', label: 'Awaiting buyer' },
    { key: 'completed', label: 'Completed' },
    { key: 'disputed', label: 'Disputed' },
  ]

  return (
    <div className="vo-page">


      <PageHeading eyebrow="From your store to their door" title="Your orders" description="A clear next step for every order. Confirm, prepare, and deliver." actions={<Link className="vx-btn vx-btn-secondary" href="/vendor/guide">Order &amp; payout guide</Link>} />
      <div className="vx-listing-summary" aria-label="Order summary"><div className="vx-summary-item"><span>Need your attention</span><strong>{counts.todo}</strong></div><div className="vx-summary-item"><span>Awaiting confirmation</span><strong>{counts.awaiting}</strong></div><div className="vx-summary-item"><span>Completed orders</span><strong>{counts.completed}</strong></div></div>
      <label className="vx-search vx-order-search"><Search size={15} /><input aria-label="Search orders" placeholder="Search order number or product…" value={query} onChange={e => setQuery(e.target.value)} type="search" /></label>

      <div className="vo-tabs" role="tablist" aria-label="Order status">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`vo-tab ${tab === t.key ? 'is-active' : ''} ${t.key === 'disputed' && counts.disputed ? 'is-alert' : ''}`}
            onClick={() => setTab(t.key)}
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
                    const step = NEXT_STEP[status]
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
                            Qty {it.quantity} · {naira(sub)} · You receive <strong>{naira(payout)}</strong>
                          </p>

                          {status === 'disputed' ? (
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

                          {status === 'delivered' && it.auto_release_at && (
                            <p className="vo-release">
                              <Clock size={14} aria-hidden /> Payout releases automatically on{' '}
                              {fmtDate(it.auto_release_at)} unless the buyer confirms sooner or raises a dispute.
                            </p>
                          )}
                          {status === 'received' && (
                            <p className="vo-release ok">
                              <PackageCheck size={14} aria-hidden /> Buyer confirmed receipt.
                            </p>
                          )}
                        </div>

                        <div className="vo-item-side">
                          {step ? (
                            <button className="vo-btn" disabled={busy} onClick={() => advance(it, step.to)}>
                              {busy ? <Loader2 size={15} className="vo-spin" aria-hidden /> : <Truck size={15} aria-hidden />}
                              {step.label}
                            </button>
                          ) : (
                            <span className={`vo-badge ${status}`}>{status}</span>
                          )}
                        </div>
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
