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
      <style>{css}</style>

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

const css = `
.vo-page{max-width:980px;margin:0 auto;padding:32px 20px 96px;color:var(--vx-text);font-family:'DM Sans',sans-serif}
.vo-head h1{font-family:'Sora',sans-serif;font-size:1.75rem;font-weight:700;letter-spacing:-.02em;margin:0 0 6px}
.vo-head p{margin:0 0 24px;opacity:.7;font-size:.95rem;max-width:56ch}
.vo-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:20px;border-bottom:1px solid var(--vx-border)}
.vo-tab{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;background:none;border:0;border-bottom:2px solid transparent;color:inherit;opacity:.65;font:inherit;font-weight:500;cursor:pointer;white-space:nowrap}
.vo-tab:hover{opacity:1}
.vo-tab.is-active{opacity:1;border-bottom-color:#2563eb}
.vo-tab:focus-visible,.vo-btn:focus-visible,.vo-btn-ghost:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.vo-count{font-size:.75rem;padding:1px 8px;border-radius:999px;background:var(--vx-border);color:var(--vx-text-soft)}
.vo-tab.is-alert .vo-count{background:#b42318;color:#fff}
.vo-error{background:var(--vx-err-bg);border:1px solid var(--vx-err-border);color:var(--vx-err-strong);padding:12px 14px;border-radius:10px;margin-bottom:16px;font-size:.9rem}
.vo-empty{text-align:center;padding:64px 16px;border:1px dashed var(--vx-border);border-radius:16px;opacity:.85}
.vo-empty h2{font-family:'Sora',sans-serif;font-size:1.05rem;margin:12px 0 4px}
.vo-empty p{margin:0;opacity:.7;font-size:.9rem}
.vo-list{display:flex;flex-direction:column;gap:16px}
.vo-card{background:var(--vx-card);border:1px solid var(--vx-border);border-radius:16px;overflow:hidden;color:var(--vx-text)}
.vo-card.is-disputed{border-color:#b42318}
.vo-flag{display:flex;align-items:center;gap:10px;background:#b42318;color:#fff;padding:12px 18px;font-family:'Sora',sans-serif;font-weight:600;font-size:.95rem}
.vo-card-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 18px;border-bottom:1px solid var(--vx-border)}
.vo-ref{font-family:'Sora',sans-serif;font-weight:600;margin-right:12px}
.vo-date{opacity:.6;font-size:.85rem}
.vo-actions{display:flex;gap:8px}
.vo-btn-ghost{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid var(--vx-border);border-radius:8px;color:var(--vx-text-soft);font-size:.85rem;text-decoration:none;transition:background .15s,border-color .15s}
.vo-btn-ghost:hover{background:var(--vx-surface);border-color:#2563eb}
.vo-items{list-style:none;margin:0;padding:0}
.vo-item{display:grid;grid-template-columns:56px 1fr auto;gap:14px;align-items:start;padding:16px 18px}
.vo-item+.vo-item{border-top:1px solid var(--vx-border)}
.vo-thumb{width:56px;height:56px;border-radius:10px;background:var(--vx-surface);display:grid;place-items:center;overflow:hidden;color:var(--vx-muted)}
.vo-thumb img{width:100%;height:100%;object-fit:cover}
.vo-item-main h3{margin:0 0 4px;font-size:.98rem;font-weight:600}
.vo-meta{margin:0 0 10px;font-size:.85rem;opacity:.75}
.vo-meta strong{color:var(--vx-link);font-weight:600}
.vo-steps{display:flex;gap:6px;list-style:none;margin:0;padding:0}
.vo-steps li{flex:1;max-width:96px;font-size:.68rem;text-transform:capitalize;letter-spacing:.03em;padding-top:8px;border-top:3px solid var(--vx-border);opacity:.5}
.vo-steps li.done{border-top-color:#2563eb;opacity:1}
.vo-reason{margin:0;font-size:.88rem;color:var(--vx-err)}
.vo-release{display:flex;gap:6px;align-items:flex-start;margin:10px 0 0;font-size:.82rem;opacity:.8;line-height:1.4}
.vo-release svg{flex:none;margin-top:2px}
.vo-release.ok{color:var(--vx-ok);opacity:1}
.vo-btn{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;background:#2563eb;color:#fff;border:0;border-radius:10px;font:inherit;font-weight:600;font-size:.85rem;cursor:pointer;transition:background .15s,transform .05s}
.vo-btn:hover:not(:disabled){background:#1d4ed8}
.vo-btn:active:not(:disabled){transform:translateY(1px)}
.vo-btn:disabled{opacity:.6;cursor:not-allowed}
.vo-badge{display:inline-block;padding:5px 10px;border-radius:999px;font-size:.75rem;text-transform:capitalize;background:var(--vx-border);color:var(--vx-text-soft)}
.vo-badge.disputed{background:#b42318;color:#fff}
.vo-badge.refunded{background:var(--vx-warn-bg2);color:var(--vx-warn)}
.vo-foot{display:flex;gap:20px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--vx-border);background:var(--vx-input);font-size:.82rem;opacity:.85}
.vo-foot span{display:inline-flex;align-items:center;gap:6px}
.vo-spin{animation:vo-spin .8s linear infinite}
@keyframes vo-spin{to{transform:rotate(360deg)}}
@media(max-width:640px){.vo-item{grid-template-columns:48px 1fr}.vo-item-side{grid-column:1 / -1}.vo-btn{width:100%;justify-content:center}}
@media(prefers-reduced-motion:reduce){.vo-spin{animation:none}.vo-btn{transition:none}}
`
