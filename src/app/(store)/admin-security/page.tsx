import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {BuyerPage} from '@/components/buyer/Page'
import AdminSecurity from './AdminSecurity'
export default async function AdminSecurityPage(){
  const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login?redirectTo=%2Fadmin-security')
  const membership=await supabase.rpc('cm_admin_membership')
  if(membership.error)return <BuyerPage title="Admin security setup" description="Administrator verification setup is required."><p className="buyer-notice">Apply the security-hardening migration before setting up administrator verification.</p></BuyerPage>
  if(membership.data!==true)notFound()
  return <BuyerPage title="Verify administrator access" description="Protect the workspace with an authenticator app."><AdminSecurity/></BuyerPage>
}
