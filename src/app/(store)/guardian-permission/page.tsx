import Link from 'next/link'
import { BuyerPage,DataError } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import type { ConsentStatus,GuardianRequest } from '@/lib/privacy/consent'
import GuardianForm from './GuardianForm'

export default async function GuardianPermissionPage(){
  const {supabase,user}=await buyerSession('/guardian-permission')
  const [consent,requests]=await Promise.all([supabase.rpc('cm_consent_status'),supabase.from('guardian_permissions').select('id,state,relationship,allows_selling,created_at,review_note').eq('guardian_id',user.id).order('created_at',{ascending:false}).limit(50)])
  const status=consent.data as ConsentStatus|null
  return <BuyerPage title="Guardian permission" description="A parent or legal guardian starts this process from their own adult account, before the student registers.">
    {consent.error||requests.error?<DataError/>:status?.eligible&&status.age_band==='adult'?<GuardianForm requests={(requests.data??[]) as GuardianRequest[]}/>:<section className="buyer-panel buyer-stack"><h2>An adult guardian account is required</h2><p>Confirm your own account permissions first. Students cannot approve their own guardian permission.</p><Link href="/consent?next=%2Fguardian-permission" className="buyer-btn">Review account permissions</Link></section>}
  </BuyerPage>
}
