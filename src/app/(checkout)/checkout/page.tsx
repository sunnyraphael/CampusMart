import { buyerSession } from '@/lib/buyer/server'
import CheckoutClient from './CheckoutClient'

export default async function CheckoutPage() {
  await buyerSession('/checkout')
  // Do not call the legacy create_order RPC: it can mark an unverified payment paid.
  // This gate stays closed until payment initialization and verified webhooks are implemented.
  return <CheckoutClient/>
}
