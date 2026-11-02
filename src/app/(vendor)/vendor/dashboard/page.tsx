import {paymentConfig,paymentService} from '@/lib/paystack/config'
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
  const orders = orderIds.length ? await supabase.from('orders').select('id, created_at').in('id', orderIds).eq('payment_status', 'paid').eq('is_trial', false).or('payment_environment.is.null,payment_environment.eq.live') : { data: [], error: null }
  if (orders.error) throw new Error('Could not load your orders.')
  let payoutReady=false
  try{const mode=paymentConfig().mode;const recipient=await paymentService().from('paystack_recipients').select('seller_id').eq('seller_id',seller.id).eq('mode',mode).maybeSingle();payoutReady=!!recipient.data&&!recipient.error}catch{}
  const overview = buildOverview((products.data ?? []) as OverviewProduct[], (items.data ?? []) as OverviewItem[], (orders.data ?? []) as OverviewOrder[])
  return <VendorDashboardClient overview={overview} sellerId={seller.id} vendorName={user.user_metadata?.full_name ?? 'Vendor'} setup={{ profile: Boolean(seller.store_name && seller.description), payout: payoutReady, verified: Boolean(seller.is_kyc_verified || seller.kyc_status === 'approved'), listing: overview.stats.activeListings > 0 }} />
}
