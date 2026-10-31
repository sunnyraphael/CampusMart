import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BuyerPage, DataError } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import EnrollButton from './EnrollButton'

export default async function StartSellingPage() {
  const {supabase,user}=await buyerSession('/start-selling')
  const {data:profile,error}=await supabase.from('users').select('role').eq('id',user.id).maybeSingle()
  if(error||!profile)return <DataError/>
  if(profile.role==='vendor') {
    const store=await supabase.from('sellers').select('id').eq('user_id',user.id).maybeSingle()
    if(store.error)return <DataError/>
    redirect(store.data?'/vendor/dashboard':'/vendor/onboarding')
  }
  return <BuyerPage title="Start selling on CampusMart" description="Open a store with your existing account. Your purchases, favorites and messages stay with you.">
    <section className="buyer-panel buyer-stack"><h2>Set up your vendor account</h2><p>Next, you will add your store name, contact information, campus and payout bank details. CampusMart takes a 5% commission per item sold. Verification can be completed from your vendor settings.</p><p>Continue when you are ready to enable vendor access on this account.</p><EnrollButton/><Link href="/profile">Back to your account</Link></section>
  </BuyerPage>
}
