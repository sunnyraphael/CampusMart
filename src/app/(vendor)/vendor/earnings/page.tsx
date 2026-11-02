import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EarningsClient from './EarningsClient'

export const dynamic = 'force-dynamic'

export default async function EarningsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/vendor/earnings')

  // Everything points to sellers.id, never user.id
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, wallet_balance')
    .eq('user_id', user.id)
    .maybeSingle()
  if (sellerError) throw new Error('Could not load your wallet.')
  if (!seller) redirect('/vendor/onboarding')

  // Newest 100 transactions, plus every item whose money has not been released yet
  const [txRes, openItemsRes, heldRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('order_items')
      .select('id, order_id, subtotal, payout_amount, fulfillment_status')
      .eq('seller_id', seller.id)
      .is('released_at', null),
    supabase.rpc('cm_vendor_delivery_holds'),
  ])

  if (heldRes.error) throw new Error('Could not load delivery review holds.')
  const heldIds = new Set<string>((heldRes.data ?? []) as string[])
  if (openItemsRes.error) throw new Error('Could not load your pending earnings.')
  const openItems = openItemsRes.data ?? []

  // Only count items from orders that were really paid
  const orderIds = [...new Set(openItems.map((i) => i.order_id))]
  const { data: paidOrders, error: ordersError } = orderIds.length
    ? await supabase.from('orders').select('id').in('id', orderIds).eq('payment_status', 'paid').eq('is_trial', false).or('payment_environment.is.null,payment_environment.eq.live')
    : { data: [] as { id: string }[], error: null }
  if (ordersError) throw new Error('Could not verify your pending earnings.')
  const paidIds = new Set((paidOrders ?? []).map((o) => o.id))

  // The vendor's cut of an item is the subtotal minus the 5% commission
  const cut = (i: { subtotal: number | null; payout_amount: number | null }) => i.payout_amount == null ? Number(i.subtotal ?? 0) - Math.round(Number(i.subtotal ?? 0) * 5) / 100 : Number(i.payout_amount)

  let inProgress = 0 // vendor still has to deliver
  let awaitingBuyer = 0 // delivered, waiting for the buyer to confirm
  let onHold = 0 // disputed, frozen
  const releasing: { id: string; amount: number; status: string; orderId: string }[] = []

  for (const it of openItems) {
    if (!paidIds.has(it.order_id)) continue
    const status = it.fulfillment_status
    if (status === 'disputed' || heldIds.has(it.id)) onHold += cut(it)
    else if (['delivered','received'].includes(status)) {
      awaitingBuyer += cut(it)
      releasing.push({ id: it.id, amount: cut(it), status, orderId: it.order_id })
    } else if (['pending', 'confirmed', 'shipped'].includes(status)) inProgress += cut(it)
  }

  return (
    <EarningsClient
      balance={Number(seller.wallet_balance ?? 0)}
      inProgress={inProgress}
      awaitingBuyer={awaitingBuyer}
      onHold={onHold}
      releasing={releasing}
      transactions={txRes.data ?? []}
      txError={txRes.error?.message ?? null}
    />
  )
}
