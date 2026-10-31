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
