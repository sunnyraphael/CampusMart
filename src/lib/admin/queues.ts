export function queueMatches(query: string, ...fields: (string | number | null | undefined)[]) {
  const text = fields.filter(value => value !== null && value !== undefined).join(' ').toLowerCase()
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(word => text.includes(word.replace(/^#/, '')))
}
export type DeliveryChecks = { is_trial?: boolean; payment_status: string; payment_verified_at: string | null; payment_verification_ref: string | null; buyer_confirmed_at: string | null; code_verified_at: string | null; held_at: string | null; fulfillment_status: string; released_at: string | null }
export function deliveryReady(item: DeliveryChecks) {
  return !!((item.is_trial || (item.payment_status === 'paid' && item.payment_verified_at && item.payment_verification_ref?.trim())) && item.buyer_confirmed_at && item.code_verified_at && !item.held_at && item.fulfillment_status === 'received' && !item.released_at)
}
type Delivery = { item_id: string; product_title: string | null; store_name: string | null; reported_at: string | null; review_after: string | null }
type Verification = { seller_id: string; store_name: string; submitted_at: string | null }
type Dispute = { item_id: string; product_title: string | null; store_name: string | null; ordered_at: string | null }
type Support = { id: string; subject: string; created_at: string | null; status: string }
export type AdminFocus = { key: string; title: string; detail: string; label: string; href: string; kind: 'delivery' | 'dispute' | 'verification' | 'support'; at: string | null; priority: number }
export function buildAdminFocus(data: { deliveries: Delivery[]; held: Delivery[]; verifications: Verification[]; disputes: Dispute[]; support: Support[] }, now = Date.now()): AdminFocus[] {
  const rows: AdminFocus[] = []
  data.disputes.forEach(i => rows.push({ key: `item:${i.item_id}`, title: i.product_title || 'Order dispute', detail: i.store_name || 'Vendor review', label: 'Dispute', href: `/admin/disputes#dispute-${i.item_id}`, kind: 'dispute', at: i.ordered_at, priority: 0 }))
  data.held.forEach(i => rows.push({ key: `item:${i.item_id}`, title: i.product_title || 'Delivery on hold', detail: i.store_name || 'Delivery review', label: 'On hold', href: `/admin/deliveries?view=held#delivery-${i.item_id}`, kind: 'delivery', at: i.reported_at, priority: 2 }))
  data.deliveries.forEach(i => { const overdue = !!i.review_after && new Date(i.review_after).getTime() <= now; rows.push({ key: `item:${i.item_id}`, title: i.product_title || 'Delivery review', detail: i.store_name || 'Delivery reported', label: overdue ? 'Follow-up due' : 'Delivery', href: `/admin/deliveries#delivery-${i.item_id}`, kind: 'delivery', at: i.reported_at, priority: overdue ? 1 : 4 }) })
  data.verifications.forEach(i => rows.push({ key: `vendor:${i.seller_id}`, title: i.store_name, detail: 'Vendor documents awaiting review', label: 'Verification', href: `/admin/verifications#verification-${i.seller_id}`, kind: 'verification', at: i.submitted_at, priority: 3 }))
  data.support.filter(i => i.status !== 'resolved').forEach(i => rows.push({ key: `support:${i.id}`, title: i.subject, detail: i.status === 'in_review' ? 'Support request in review' : 'New support request', label: 'Support', href: `/admin/support?request=${encodeURIComponent(i.id)}#support-${i.id}`, kind: 'support', at: i.created_at, priority: 5 }))
  const seen = new Set<string>()
  return rows.sort((a, b) => a.priority - b.priority || (a.at ? new Date(a.at).getTime() : Infinity) - (b.at ? new Date(b.at).getTime() : Infinity)).filter(i => { if (seen.has(i.key)) return false; seen.add(i.key); return true }).slice(0, 6)
}
