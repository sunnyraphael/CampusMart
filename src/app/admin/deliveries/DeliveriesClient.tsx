'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Inbox, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils/format'
import { trackingDate, type OrderTracking, type TrackingEvent } from '@/lib/orders/tracking'
import TrackingTimeline from '@/components/orders/TrackingTimeline'
import OrderRefresh from '@/components/orders/OrderRefresh'

export type DeliveryApproval = {
  is_trial?: boolean; item_id: string; order_id: string; quantity: number; subtotal: number; commission_amount: number; payout_amount: number
  fulfillment_status: string; dispute_reason: string | null; product_title: string | null; store_name: string | null
  buyer_name: string | null; buyer_email: string | null; buyer_phone: string | null
  delivery_method: string; delivery_address: string | null; payment_status: string
  payment_verified_at: string | null; payment_verification_ref: string | null
  expected_by: string | null; courier: string | null; tracking_number: string | null; tracking_url: string | null
  delivery_note: string | null; reported_at: string | null; review_after: string | null
  buyer_confirmed_at: string | null; code_verified_at: string | null; held_at: string | null; hold_note: string | null
  approved_at: string | null; approval_note: string | null; released_at: string | null; events: TrackingEvent[]
}
type View = 'pending' | 'held' | 'approved'
export default function DeliveriesClient({ items, view, page, hasMore }: { items: DeliveryApproval[]; view: View; page: number; hasMore: boolean }) {
  return <section className="ot-admin">
    <header className="ot-admin-head"><div><h1>Delivery approvals</h1><p>Check payment, handover and buyer confirmation before crediting a vendor.</p></div><OrderRefresh /></header>
    <nav className="ot-admin-tabs" aria-label="Delivery approval views">{(['pending', 'held', 'approved'] as const).map(v => <Link key={v} className="buyer-btn" href={`/admin/deliveries?view=${v}`} aria-current={view === v ? 'page' : undefined}>{v === 'pending' ? 'Awaiting review' : v === 'held' ? 'On hold' : 'Approved'}</Link>)}</nav>
    <p className="buyer-notice"><ShieldCheck size={20} aria-hidden />Real vendor credit requires a server-verified payment, the buyer’s receipt confirmation, a verified handover code, and your approval. Bank transfers and refunds are separate. Orders never release automatically.</p>
    {!items.length && <div className="ot-admin-empty"><Inbox size={30} aria-hidden /><h2>No deliveries in this view</h2><p>Delivery reports and buyer confirmations will appear here.</p></div>}
    {items.map(item => <ApprovalCard key={item.item_id} item={item} />)}
    <nav className="buyer-actions" aria-label="Delivery approval pages">{page > 1 && <Link className="buyer-btn" href={`/admin/deliveries?view=${view}&page=${page - 1}`}>Previous</Link>}{hasMore && <Link className="buyer-btn" href={`/admin/deliveries?view=${view}&page=${page + 1}`}>Next</Link>}</nav>
  </section>
}
function ApprovalCard({ item: i }: { item: DeliveryApproval }) {
  const router = useRouter()
  const [refreshing, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'approve' | 'hold' | 'resume' | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const verifiedPayment = i.payment_status === 'paid' && !!i.payment_verified_at && !!i.payment_verification_ref
  const canApprove = (i.is_trial || verifiedPayment) && !!i.buyer_confirmed_at && !!i.code_verified_at && !i.held_at && i.fulfillment_status === 'received' && !i.released_at
  const t: OrderTracking = { ...i, status: i.fulfillment_status, created_at: null }
  const overdue = !!i.review_after && new Date(i.review_after).getTime() <= Date.now() && !i.released_at
  const checks = [
    { label: i.is_trial ? 'Trial order - no payment collected; approval is simulated' : verifiedPayment ? `Payment verified · ${i.payment_verification_ref}` : 'Payment verification pending', done: !!i.is_trial||verifiedPayment },
    { label: i.buyer_confirmed_at ? `Buyer confirmed · ${trackingDate(i.buyer_confirmed_at)}` : 'Buyer confirmation pending', done: !!i.buyer_confirmed_at },
    { label: i.code_verified_at ? `Handover code verified · ${trackingDate(i.code_verified_at)}` : 'Handover code not verified', done: !!i.code_verified_at },
    { label: i.fulfillment_status === 'disputed' ? 'Open buyer dispute' : i.held_at ? 'Admin review hold' : 'No open review hold or dispute', done: !i.held_at && i.fulfillment_status !== 'disputed' },
  ]
  async function decide() {
    if (busy || refreshing || !mode) return
    if (note.trim().length < 5) { setError('Explain what you checked in at least 5 characters.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const { error } = mode === 'approve'
        ? await createClient().rpc('cm_admin_approve_delivery', { p_item_id: i.item_id, p_note: note.trim() })
        : await createClient().rpc('cm_admin_hold_delivery', { p_item_id: i.item_id, p_note: note.trim(), p_hold: mode === 'hold' })
      if (error) { setError(error.message); return }
      setNotice(mode === 'approve' ? i.is_trial ? 'Trial delivery approved. No real wallet funds were created.' : 'Vendor wallet credited. No bank transfer was initiated.' : mode === 'hold' ? 'Delivery placed on hold.' : 'Delivery returned to review.')
      setMode(null); setNote(''); startTransition(() => router.refresh())
    } catch { setError('The decision could not be saved. Check your connection and retry.') } finally { setBusy(false) }
  }
  return <article className="ot-approval-card">
    <header><div><h2>{i.product_title ?? 'Purchased item'}</h2><p className="buyer-help">Order #{i.order_id.slice(0, 8).toUpperCase()} · Item {i.item_id.slice(-6)} · Quantity {i.quantity}</p></div><span className={`buyer-status ${i.released_at ? 'is-good' : 'is-warn'}`}>{i.released_at ? i.is_trial ? 'Trial completed' : 'Credited' : overdue ? 'Needs follow-up' : 'Under review'}</span></header>
    <div className="ot-admin-people"><div><strong>Buyer · {i.buyer_name || 'Name unavailable'}</strong><p>{i.buyer_email}</p><p>{i.buyer_phone}</p><p>{i.delivery_method === 'pickup' ? 'Campus pickup' : i.delivery_address || 'Delivery address unavailable'}</p></div><div><strong>Vendor · {i.store_name || 'Store unavailable'}</strong><p>Item subtotal: {formatPrice(Number(i.subtotal))}</p><p>CampusMart commission (5%): {formatPrice(Number(i.commission_amount))}</p><p><strong>{i.is_trial?'Simulated vendor credit':'Vendor credit'}: {formatPrice(Number(i.payout_amount))}</strong></p></div></div>
    {i.is_trial&&<p className="buyer-notice">TRIAL ORDER - Test the approval procedure. No payment was collected and approving this order will not credit a real vendor wallet.</p>}
    <ul className="ot-checks" aria-label="Approval requirements">{checks.map(check => <li key={check.label} className={check.done ? 'is-checked' : ''}>{check.done ? <CheckCircle2 size={16} aria-hidden /> : <Clock size={16} aria-hidden />}<span>{check.label}</span></li>)}</ul>
    {i.hold_note && <p className="buyer-notice">Review note: {i.hold_note}</p>}
    {i.dispute_reason && i.fulfillment_status === 'disputed' && <p className="buyer-notice">Buyer’s report: {i.dispute_reason}</p>}
    {overdue && <p className="buyer-help">Follow up with the buyer and vendor. Reaching the review time does not release money.</p>}
    <TrackingTimeline tracking={t} pickup={i.delivery_method === 'pickup'} />
    {i.events.some(e => e.admin_note) && <details className="ot-history"><summary>Admin decision notes</summary><ol>{i.events.filter(e => e.admin_note).map(e => <li key={e.id}><span>{e.admin_note}</span><time dateTime={e.created_at}>{trackingDate(e.created_at)}</time></li>)}</ol></details>}
    {i.released_at ? <p className="buyer-help">Approved {trackingDate(i.approved_at)} · {i.approval_note}</p> : i.fulfillment_status === 'disputed' ? <Link href="/admin/disputes" className="buyer-btn">Review buyer dispute</Link> : <div className="ot-admin-action">
      {!verifiedPayment && !i.is_trial && <p className="buyer-help">Credit stays blocked until payment integration supplies a verified payment reference.</p>}
      {!mode ? <div className="buyer-actions"><button className="buyer-btn is-primary" disabled={!canApprove || busy || refreshing} onClick={() => { setMode('approve'); setError('') }}>{i.is_trial?'Approve trial delivery':'Approve vendor credit'}</button><button className="buyer-btn" disabled={busy || refreshing} onClick={() => { setMode(i.held_at ? 'resume' : 'hold'); setError('') }}>{i.held_at ? 'Resume review' : 'Hold for review'}</button></div> : <form onSubmit={e => { e.preventDefault(); void decide() }}>
        <p className="buyer-help">{mode === 'approve' && i.is_trial ? 'This completes the trial approval only. The displayed credit is simulated; real balances stay unchanged.' : mode === 'approve' ? `This adds ${formatPrice(Number(i.payout_amount))} to the vendor’s wallet. Confirm that you checked all delivery evidence.` : mode === 'hold' ? 'Keep the credit held while you investigate.' : 'Return this delivery to the approval queue. This does not credit the vendor.'}</p>
        <label htmlFor={`review-${i.item_id}`}>Your review note</label><textarea id={`review-${i.item_id}`} className="ot-admin-note" value={note} onChange={e => setNote(e.target.value)} minLength={5} maxLength={1000} required />
        <div className="buyer-actions"><button className="buyer-btn is-primary" disabled={busy || refreshing || (mode === 'approve' && !canApprove)}>{busy ? 'Saving…' : mode === 'approve' ? i.is_trial ? 'Confirm trial approval' : 'Confirm vendor credit' : mode === 'hold' ? 'Confirm hold' : 'Confirm resume'}</button><button type="button" className="buyer-btn" disabled={busy || refreshing} onClick={() => { setMode(null); setError('') }}>Cancel</button></div>
      </form>}
    </div>}
    {error && <p className="ot-error" role="alert">{error}</p>}{notice && <p role="status" className="buyer-help">{notice}</p>}
  </article>
}
