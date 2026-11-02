import StoreControls from '@/components/vendor/StoreControls'
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

  const controls=await supabase.rpc('cm_store_overview',{p_seller:seller.id})
  return <SettingsClient seller={seller} controls={<>{controls.error?<p className="buyer-notice">Store controls could not load. Apply the store-management migration and refresh.</p>:<StoreControls sellerId={seller.id} state={controls.data}/>}<section className="ss-card" style={{marginTop:24}}><h2 className="ss-title">Permissions & privacy</h2><p className="buyer-help">Review vendor terms or manage your buyer account and data requests. Existing orders and payouts remain your responsibility.</p><div className="buyer-actions"><Link className="buyer-btn" href="/consent?next=%2Fvendor%2Fsettings&vendor=1">Vendor terms</Link><Link className="buyer-btn" href="/settings#account-controls">Account & privacy controls</Link></div></section></>}/>
}
