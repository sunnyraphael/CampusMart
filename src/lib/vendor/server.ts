import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function vendorSession(path: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect(`/login?redirectTo=${encodeURIComponent(path)}`)
  const { data: seller, error } = await supabase.from('sellers').select('id, store_name, description, logo_url, bank_name, account_number, account_name, is_kyc_verified, kyc_status').eq('user_id', user.id).maybeSingle()
  if (error) throw new Error('Could not load your store. Please try again.')
  if (!seller) redirect('/vendor/onboarding')
  return { supabase, user, seller }
}
