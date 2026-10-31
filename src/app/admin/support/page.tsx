import { adminSession } from '@/lib/admin/server'
import SupportClient, { type SupportRequest } from './SupportClient'
import { z } from 'zod'

export default async function SupportQueuePage({searchParams}:{searchParams:Promise<{request?:string}>}) {
  const {supabase}=await adminSession()
  const params=await searchParams
  const {data,error}=await supabase.from('support_requests').select('id,subject,body,status,admin_reply,created_at,order_id').order('created_at',{ascending:false}).limit(100)
  const items=(data??[]) as SupportRequest[]
  const focused=z.uuid().safeParse(params.request)
  if(!error&&focused.success&&!items.some(item=>item.id===focused.data)){
    const result=await supabase.from('support_requests').select('id,subject,body,status,admin_reply,created_at,order_id').eq('id',focused.data).maybeSingle()
    if(result.error)return <SupportClient items={items} loadError/>
    if(result.data)items.unshift(result.data as SupportRequest)
  }
  return <SupportClient items={items} loadError={!!error}/>
}
