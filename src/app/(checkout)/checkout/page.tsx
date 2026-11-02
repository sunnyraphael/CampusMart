import { requireMarketplacePermission } from '@/lib/privacy/consent-server'
import CheckoutClient from './CheckoutClient'
import { trialCheckoutEnabled } from '@/lib/orders/trial'
import { paymentConfig,paymentsEnabled } from '@/lib/paystack/config'

export default async function CheckoutPage() {
  const {user}=await requireMarketplacePermission('/checkout')
  // Trial creation has its own server-only RPC; legacy payment simulation remains unused.
  const paystackMode=paymentsEnabled()?paymentConfig().mode:null
  return <CheckoutClient buyerId={user.id} trialEnabled={!paystackMode&&trialCheckoutEnabled(process.env)} paystackMode={paystackMode}/>
}
