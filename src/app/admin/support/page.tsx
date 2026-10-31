import { createClient } from '@/lib/supabase/server'
import { BuyerPage, DataError, EmptyState } from '@/components/buyer/Page'
import ReplyForm from './ReplyForm'

export default async function SupportQueuePage() {
  const supabase=await createClient()
  const {data,error}=await supabase.from('support_requests').select('id,subject,body,status,admin_reply,created_at,order_id').order('created_at',{ascending:false}).limit(100)
  return <BuyerPage title="Support requests" description="Review buyer requests and send a response to their support history.">
    {error?<DataError/>:!data?.length?<EmptyState title="No requests to review">New support requests will appear here.</EmptyState>:data.map((r)=><article className="buyer-panel buyer-stack" key={r.id}><h2>{r.subject}</h2><p className="buyer-help">Reference {r.id.slice(0,8).toUpperCase()}{r.order_id&&` · Order ${r.order_id.slice(0,8).toUpperCase()}`}</p><p className="buyer-preserve-lines">{r.body}</p><ReplyForm id={r.id} status={r.status} reply={r.admin_reply??''}/></article>)}
  </BuyerPage>
}
