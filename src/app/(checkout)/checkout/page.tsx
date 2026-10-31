import { buyerSession } from '@/lib/buyer/server'
import CheckoutClient from './CheckoutClient'
import { trialCheckoutEnabled } from '@/lib/orders/trial'

export default async function CheckoutPage() {
  await buyerSession('/checkout')
  // Trial creation has its own server-only RPC; legacy payment simulation remains unused.
  return <CheckoutClient trialEnabled={trialCheckoutEnabled(process.env)}/>
}
