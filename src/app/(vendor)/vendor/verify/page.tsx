import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VerifyClient from './VerifyClient'

export const dynamic = 'force-dynamic'

export default async function VerifyPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/vendor/verify')

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('is_kyc_verified, kyc_status, kyc_rejection_reason, kyc_submitted_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new Error('Could not load your verification status.')
  if (!seller) redirect('/vendor/onboarding')

  return (
    <VerifyClient
      userId={user.id}
      verified={!!seller.is_kyc_verified}
      status={seller.kyc_status}
      reason={seller.kyc_rejection_reason}
      submittedAt={seller.kyc_submitted_at}
    />
  )
}
