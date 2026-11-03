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

  const [txRes,pending]=await Promise.all([
    supabase.from('transactions').select('*').eq('seller_id',seller.id).order('created_at',{ascending:false}).limit(100),
    supabase.rpc('cm_vendor_pending_earnings'),
  ])
  if(pending.error||!pending.data)throw new Error('Could not load pending earnings.')
  const {inProgress,awaitingBuyer,onHold,releasing}=pending.data
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
