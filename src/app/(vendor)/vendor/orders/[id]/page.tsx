import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, FileText, Package, ShieldAlert, Clock, MapPin, Phone, User, StickyNote } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getVendorOrder, pick, naira, fmtDate, itemSubtotal } from '@/lib/vendor-orders'
import ItemStatusButton from './ItemStatusButton'
import { PageHeading } from '@/components/vendor/Workspace'

export const dynamic = 'force-dynamic'

const NEXT_STEP: Record<string, { to: string; label: string }> = {
  pending: { to: 'confirmed', label: 'Confirm order' },
  confirmed: { to: 'shipped', label: 'Mark as shipped' },
  shipped: { to: 'delivered', label: 'Mark as delivered' },
}

export default async function VendorOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params // Next.js 16: params is a Promise
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/vendor/orders/${id}`)

  const data = await getVendorOrder(supabase, id, user.id)
  if (!data) notFound()
  const { order, items, products } = data

  const productById = new Map(products.map((p) => [p.id, p]))
  const disputed = items.filter((i) => i.fulfillment_status === 'disputed')
  const ref = String(order.id).slice(0, 8).toUpperCase()

  const buyer = pick(order, ['full_name', 'buyer_name', 'customer_name', 'name'])
  const phone = pick(order, ['phone_number', 'phone', 'buyer_phone', 'delivery_phone', 'contact_phone'])
  const method = pick(order, ['delivery_method', 'fulfillment_method', 'delivery_type'])
  const address = pick(order, ['delivery_address', 'address', 'shipping_address'])
  const notes = pick(order, ['delivery_notes', 'notes', 'note'])

  return (
    <div className="od-page">
      <style>{css}</style>

      <Link href="/vendor/orders" className="od-back">
        <ArrowLeft size={16} aria-hidden /> All orders
      </Link>

      <PageHeading eyebrow="Order details" title={`Order #${ref}`} description={`Placed ${fmtDate(order.created_at)}`} actions={<Link href={`/vendor/orders/${order.id}/slip`} className="vx-btn vx-btn-secondary">
          <FileText size={15} aria-hidden /> Print packing slip
        </Link>} />
      <div className="vx-order-summary"><span><Package size={17} />{items.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0)} units in your part of this order</span><strong>{naira(items.reduce((sum, i) => sum + itemSubtotal(i), 0))}</strong></div>

      {disputed.length > 0 && (
        <section className="od-dispute" role="alert">
          <ShieldAlert size={36} aria-hidden />
          <div>
            <h2>DISPUTED</h2>
            <p>
              The buyer reported a problem with this order. Your payout is frozen and the status buttons are
              locked until it is reviewed.
            </p>
            {disputed.map((i) => (
              <p key={i.id} className="od-reason">
                Reason: {i.dispute_reason || 'No reason provided'}
              </p>
            ))}
          </div>
        </section>
      )}

      <div className="od-grid">
        <section className="od-col">
          {items.map((it) => {
            const p = productById.get(it.product_id)
            const img = Array.isArray(p?.images) ? p?.images[0] : pick(p, ['image_url', 'image'])
            const sub = itemSubtotal(it)
            const payout = Number(it.payout_amount ?? sub * 0.95)
            const status: string = it.fulfillment_status
            const step = NEXT_STEP[status]
            return (
              <article key={it.id} className={`od-card ${status === 'disputed' ? 'is-disputed' : ''}`}>
                <div className="od-row">
                  <div className="od-thumb">
                    {img ? <img src={img} alt="" /> : <Package size={22} strokeWidth={1.5} aria-hidden />}
                  </div>
                  <div className="od-main">
                    <h3>{p?.title ?? 'Product'}</h3>
                    <p className="od-meta">
                      {status === 'refunded' ? (
                        <>Qty {it.quantity} · {naira(sub)} · Refunded to the buyer. No payout for this item.</>
                      ) : (
                        <>
                          Qty {it.quantity} · {naira(sub)} · Platform fee {naira(sub - payout)} · You receive{' '}
                          <strong>{naira(payout)}</strong>
                        </>
                      )}
                    </p>
                    <span className={`od-badge ${status}`}>{status}</span>
                  </div>
                </div>

                {status === 'delivered' && it.auto_release_at && (
                  <p className="od-release">
                    <Clock size={14} aria-hidden /> Payout releases automatically on {fmtDate(it.auto_release_at)}{' '}
                    unless the buyer confirms sooner or raises a dispute.
                  </p>
                )}

                {step && (
                  <div className="od-act">
                    <ItemStatusButton itemId={it.id} to={step.to} label={step.label} />
                  </div>
                )}
              </article>
            )
          })}
        </section>

        <aside className="od-card od-side">
          <h3>Delivery</h3>
          <dl>
            {buyer && (
              <div><dt><User size={14} aria-hidden /> Buyer</dt><dd>{String(buyer)}</dd></div>
            )}
            {phone && (
              <div><dt><Phone size={14} aria-hidden /> Phone</dt><dd>{String(phone)}</dd></div>
            )}
            {(method || address) && (
              <div>
                <dt><MapPin size={14} aria-hidden /> Method</dt>
                <dd>{[method, address].filter(Boolean).join(', ')}</dd>
              </div>
            )}
            {notes && (
              <div><dt><StickyNote size={14} aria-hidden /> Notes</dt><dd>{String(notes)}</dd></div>
            )}
          </dl>
        </aside>
      </div>
      <p className="vx-chat-help">Need help with this order? <Link href="/contact">Contact support</Link> with order reference #{ref}.</p>
    </div>
  )
}

const css = `
.od-page{max-width:980px;margin:0 auto;padding:28px 20px 96px;color:var(--vx-text);font-family:'DM Sans',sans-serif}
.od-back{display:inline-flex;align-items:center;gap:6px;color:var(--vx-link);text-decoration:none;font-size:.88rem;margin-bottom:18px}
.od-back:hover{text-decoration:underline}
.od-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.od-head h1{font-family:'Sora',sans-serif;font-size:1.6rem;margin:0 0 4px;letter-spacing:-.02em}
.od-head p{margin:0;opacity:.65;font-size:.9rem}
.od-ghost{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid var(--vx-border);border-radius:8px;color:var(--vx-text-soft);text-decoration:none;font-size:.85rem}
.od-ghost:hover{background:var(--vx-surface);border-color:#2563eb}
.od-dispute{display:flex;gap:16px;align-items:flex-start;background:#b42318;color:#fff;border-radius:16px;padding:22px;margin-bottom:20px}
.od-dispute svg{flex:none}
.od-dispute h2{font-family:'Sora',sans-serif;font-size:1.8rem;letter-spacing:.06em;margin:0 0 6px}
.od-dispute p{margin:0 0 6px;line-height:1.5}
.od-reason{background:var(--vx-inset);padding:10px 12px;border-radius:8px;font-size:.9rem}
.od-grid{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}
.od-col{display:flex;flex-direction:column;gap:16px}
.od-card{background:var(--vx-card);border:1px solid var(--vx-border);border-radius:16px;padding:18px}
.od-card.is-disputed{border-color:#b42318}
.od-row{display:flex;gap:14px}
.od-thumb{width:64px;height:64px;border-radius:10px;background:var(--vx-surface);display:grid;place-items:center;overflow:hidden;color:var(--vx-muted);flex:none}
.od-thumb img{width:100%;height:100%;object-fit:cover}
.od-main h3{margin:0 0 4px;font-size:1rem}
.od-meta{margin:0 0 10px;font-size:.85rem;opacity:.75;line-height:1.5}
.od-meta strong{color:var(--vx-link)}
.od-badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:.74rem;text-transform:capitalize;background:var(--vx-border);color:var(--vx-text-soft)}
.od-badge.disputed{background:#b42318;color:#fff}
.od-badge.refunded{background:var(--vx-warn-bg2);color:var(--vx-warn)}
.od-release{display:flex;gap:6px;margin:14px 0 0;font-size:.82rem;opacity:.8;line-height:1.4}
.od-release svg{flex:none;margin-top:2px}
.od-act{margin-top:16px;padding-top:16px;border-top:1px solid var(--vx-border)}
.od-side h3{font-family:'Sora',sans-serif;font-size:.95rem;margin:0 0 12px}
.od-side dl{margin:0;display:flex;flex-direction:column;gap:14px}
.od-side dt{display:flex;align-items:center;gap:6px;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;opacity:.6;margin-bottom:3px}
.od-side dd{margin:0;font-size:.9rem;line-height:1.45;word-break:break-word}
.od-spin{animation:od-spin .8s linear infinite}
@keyframes od-spin{to{transform:rotate(360deg)}}
@media(max-width:760px){.od-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.od-spin{animation:none}}
`
