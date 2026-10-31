import { vendorSession } from '@/lib/vendor/server'
import { buildOverview, type OverviewProduct, type OverviewItem, type OverviewOrder } from '@/lib/vendor/overview'
import VendorDashboardClient from './VendorDashboardClient'

export const dynamic = 'force-dynamic'

export default async function VendorDashboardPage() {
  const { supabase, user, seller } = await vendorSession('/vendor/dashboard')
  const [products, items] = await Promise.all([
    supabase.from('products').select('id, title, images, status, stock_quantity, availability').eq('seller_id', seller.id),
    supabase.from('order_items').select('id, order_id, product_id, quantity, subtotal, payout_amount, fulfillment_status, released_at').eq('seller_id', seller.id),
  ])
  if (products.error || items.error) throw new Error('Could not load your store overview.')
  const orderIds = [...new Set((items.data ?? []).map(i => i.order_id))]
  const orders = orderIds.length ? await supabase.from('orders').select('id, created_at').in('id', orderIds).eq('payment_status', 'paid') : { data: [], error: null }
  if (orders.error) throw new Error('Could not load your orders.')
  const overview = buildOverview((products.data ?? []) as OverviewProduct[], (items.data ?? []) as OverviewItem[], (orders.data ?? []) as OverviewOrder[])
  return <VendorDashboardClient overview={overview} sellerId={seller.id} vendorName={user.user_metadata?.full_name ?? 'Vendor'} setup={{ profile: Boolean(seller.store_name && seller.description), payout: Boolean(seller.bank_name && seller.account_number && seller.account_name), verified: Boolean(seller.is_kyc_verified || seller.kyc_status === 'approved'), listing: overview.stats.activeListings > 0 }} />
}
