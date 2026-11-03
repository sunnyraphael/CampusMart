import{notFound,redirect}from'next/navigation'
import{createClient}from'@/lib/supabase/server'
import{BuyerPage}from'@/components/buyer/Page'
import AdminSecurity from'./AdminSecurity'
export default async function AdminSecurityPage({searchParams}:{searchParams:Promise<{pin?:string}>}){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser()
 if(!user)redirect('/login?redirectTo=%2Fadmin-security')
 const membership=await supabase.rpc('cm_admin_membership');if(membership.error)return <BuyerPage title="Admin security setup" description="Setup is required."><p className="buyer-notice">Apply the security migrations before setting up administrator access.</p></BuyerPage>
 if(membership.data!==true)notFound()
 const allowed=await supabase.rpc('is_admin'),status=allowed.data===true?await supabase.rpc('cm_admin_pin_status'):{data:null}
 return <BuyerPage title="Admin password & transaction PIN" description="Unlock with your existing account password and protect each money decision with a PIN."><AdminSecurity email={user.email??''} configured={status.data?.configured===true} managePin={(await searchParams).pin==='1'}/></BuyerPage>
}
