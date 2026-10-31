import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/vendor/settings')

  // Ask only for the columns this page needs, never select('*')
  const { data: seller, error } = await supabase
    .from('sellers')
    .select(
      'id, store_name, description, logo_url, category, phone, whatsapp, state, campus, bank_name, account_number, account_name, is_kyc_verified, kyc_status, kyc_rejection_reason'
    )
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new Error('Could not load your store settings.')
  if (!seller) redirect('/vendor/onboarding')

  return <SettingsClient seller={seller} />
}
