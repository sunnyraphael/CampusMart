export type TrackingEvent = { id: string; status: string; note: string | null; created_at: string; admin_note?: string | null }
export type OrderTracking = {
  is_trial?: boolean
  item_id: string; status: string; created_at: string | null; expected_by: string | null
  courier: string | null; tracking_number: string | null; tracking_url: string | null; delivery_note: string | null
  reported_at: string | null; review_after: string | null; buyer_confirmed_at: string | null
  code_verified_at: string | null; held_at: string | null; approved_at: string | null; released_at: string | null
  events: TrackingEvent[]
}
export const deliverySteps = [
  { status: 'pending', label: 'Order placed' }, { status: 'confirmed', label: 'Preparing' },
  { status: 'shipped', label: 'On the way' }, { status: 'delivered', label: 'Delivery reported' },
  { status: 'received', label: 'Receipt confirmed' },
] as const
export const nextDeliveryStep: Record<string, { to: string; label: string }> = {
  pending: { to: 'confirmed', label: 'Confirm order' },
  confirmed: { to: 'shipped', label: 'Mark as shipped' },
  shipped: { to: 'delivered', label: 'Report delivery' },
}
export function trackingDate(value?: string | null) {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function safeTrackingUrl(value?: string | null) {
  if (!value) return undefined
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}
export function creditLabel(t: Pick<OrderTracking, 'released_at' | 'held_at' | 'buyer_confirmed_at' | 'is_trial'>, status: string) {
  if (status === 'cancelled') return t.is_trial ? 'Trial cancelled · no payment collected or vendor credit' : 'Order cancelled · check refund status with support'
  if (t.is_trial && t.released_at) return 'Trial completed · no real vendor credit'
  if (t.is_trial && status === 'refunded') return 'Trial refund approved · no real refund sent'
  if (t.is_trial && (t.held_at || status === 'disputed')) return 'Trial approval on hold'
  if (t.is_trial && t.buyer_confirmed_at) return 'Awaiting admin trial approval'
  if (t.is_trial) return 'Trial delivery in progress · no payment collected'
  if (status === 'refunded') return 'Refund approved · transfer handled separately'
  if (t.released_at) return 'Vendor wallet credited'
  if (t.held_at || status === 'disputed') return 'Vendor credit on hold'
  if (t.buyer_confirmed_at) return 'Awaiting admin approval'
  return 'Vendor credit held until delivery is verified and approved'
}
