import {paymentConfig,paymentService} from '@/lib/paystack/config'
import { vendorSession } from '@/lib/vendor/server'
import { type Overview } from '@/lib/vendor/overview'
import VendorDashboardClient from './VendorDashboardClient'

export const dynamic = 'force-dynamic'

export default async function VendorDashboardPage() {
  const { supabase, user, seller } = await vendorSession('/vendor/dashboard')
  const result=await supabase.rpc('cm_vendor_overview')
  if(result.error||!result.data)throw new Error('Could not load your store overview.')
  let payoutReady=false
  try{const mode=paymentConfig().mode;const recipient=await paymentService().from('paystack_recipients').select('seller_id').eq('seller_id',seller.id).eq('mode',mode).maybeSingle();payoutReady=!!recipient.data&&!recipient.error}catch{}
  const overview = result.data as Overview
  return <VendorDashboardClient overview={overview} sellerId={seller.id} vendorName={user.user_metadata?.full_name ?? 'Vendor'} setup={{ profile: Boolean(seller.store_name && seller.description), payout: payoutReady, verified: Boolean(seller.is_kyc_verified || seller.kyc_status === 'approved'), listing: overview.stats.activeListings > 0 }} />
}
