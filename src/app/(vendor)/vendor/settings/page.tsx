import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import Link from 'next/link'

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
      'id, store_name, description, logo_url, category, phone, whatsapp, state, campus, is_kyc_verified, kyc_status, kyc_rejection_reason'
    )
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new Error('Could not load your store settings.')
  if (!seller) redirect('/vendor/onboarding')

  return <><SettingsClient seller={seller}/><section className="vx-panel" style={{marginTop:24}}><h2>Store permissions and closure</h2><p className="buyer-help">Review the current vendor terms or close your store while keeping your buyer account. Existing orders, disputes and payouts remain your responsibility.</p><div className="buyer-actions"><Link className="buyer-btn" href="/consent?next=%2Fvendor%2Fsettings&vendor=1">Review vendor terms</Link><Link className="buyer-btn" href="/settings#account-controls">Privacy and account controls</Link></div></section></>
}
