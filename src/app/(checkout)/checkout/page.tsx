import { requireMarketplacePermission } from '@/lib/privacy/consent-server'
import CheckoutClient from './CheckoutClient'
import { trialCheckoutEnabled } from '@/lib/orders/trial'

export default async function CheckoutPage() {
  await requireMarketplacePermission('/checkout')
  // Trial creation has its own server-only RPC; legacy payment simulation remains unused.
  return <CheckoutClient trialEnabled={trialCheckoutEnabled(process.env)}/>
}
