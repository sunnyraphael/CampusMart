import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BuyerPage, DataError } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import { requireMarketplacePermission } from '@/lib/privacy/consent-server'
import EnrollButton from './EnrollButton'

export default async function StartSellingPage() {
  await requireMarketplacePermission('/start-selling')
  const {supabase,user}=await buyerSession('/start-selling')
  const {data:profile,error}=await supabase.from('users').select('role').eq('id',user.id).maybeSingle()
  if(error||!profile)return <DataError/>
  if(profile.role==='vendor') {
    const store=await supabase.from('sellers').select('id').eq('user_id',user.id).maybeSingle()
    if(store.error)return <DataError/>
    redirect(store.data?'/vendor/dashboard':'/vendor/onboarding')
  }
  return <BuyerPage title="Start selling on CampusMart" description="Open a store with your existing account. Your purchases, favorites and messages stay with you.">
    <section className="buyer-panel buyer-stack"><h2>Set up your vendor account</h2><p>Next, you will add your store name, contact information, campus. Bank details can be added later when payouts are available. Launch offer: 0% vendor commission for a limited time. We will announce any future commission before it applies to new orders. Verification can be completed from your vendor settings.</p><p>Store owners must be 18 or older, or have reviewed guardian permission explicitly covering selling. Vendor earnings require delivery review and a separate admin approval; a trial approval never creates real funds.</p><EnrollButton/><Link href="/profile">Back to your account</Link></section>
  </BuyerPage>
}
