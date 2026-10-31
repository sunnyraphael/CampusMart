import { BuyerPage, DataError, EmptyState } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import NotificationsClient from './NotificationsClient'

export default async function NotificationsPage() {
  const {supabase,user}=await buyerSession('/notifications')
  const {data,error}=await supabase.from('notifications').select('id,message,is_read,created_at,order_id').eq('user_id',user.id).order('created_at',{ascending:false}).order('id').limit(100)
  return <BuyerPage title="Notifications" description="Your latest order and account updates. Messages have their own inbox.">
    {error?<DataError/>:!data?.length?<EmptyState title="You are all caught up">New order updates will appear here.</EmptyState>:<NotificationsClient rows={data}/>}
  </BuyerPage>
}
