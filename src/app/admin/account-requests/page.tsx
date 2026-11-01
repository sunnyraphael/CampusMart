import { adminSession } from '@/lib/admin/server'
import AccountRequestsClient, { type AdminAccountRequest } from './AccountRequestsClient'
import './requests.css'
export default async function AccountRequestsPage({searchParams}:{searchParams:Promise<{view?:string}>}){
  const {supabase}=await adminSession()
  const {view}=await searchParams
  const closed=view==='closed'
  const {data,error}=await supabase.rpc('cm_admin_account_requests',{p_view:closed?'closed':'open'})
  return <AccountRequestsClient key={closed?'closed':'open'} items={(data??[]) as AdminAccountRequest[]} closed={closed} loadError={!!error}/>
}
