import Link from 'next/link'
import { BuyerPage, DataError, EmptyState } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import NotificationsClient from './NotificationsClient'
import { notificationOrderLinks } from '@/lib/orders/notification-links'

export default async function NotificationsPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=Math.max(1,Math.min(10000,parseInt((await searchParams).page??'1')||1))
  const {supabase,user}=await buyerSession('/notifications')
  const {data:allRows,error}=await supabase.from('notifications').select('id,message,is_read,created_at,order_id').eq('user_id',user.id).order('created_at',{ascending:false}).order('id').range((page-1)*50,page*50)
  const data=allRows?.slice(0,50)
  const orderIds=[...new Set((data??[]).flatMap(r=>r.order_id?[r.order_id]:[]))]
  let links:Record<string,string>={}
  let linkError=false
  if(!error&&orderIds.length) {
    const [orders,seller]=await Promise.all([
      supabase.from('orders').select('id,user_id').in('id',orderIds),
      supabase.from('sellers').select('id').eq('user_id',user.id).maybeSingle(),
    ])
    // Return one parent row per sale, so many line items cannot truncate the link lookup.
    const sales=seller.data?await supabase.from('orders').select('id,order_items!inner(seller_id)').in('id',orderIds).eq('order_items.seller_id',seller.data.id):{data:[],error:null}
    linkError=!!(orders.error||seller.error||sales.error)
    if(!linkError)links=notificationOrderLinks(user.id,orders.data??[],(sales.data??[]).map(o=>o.id))
  }
  return <BuyerPage title="Notifications" description="Your latest order and account updates. Messages have their own inbox.">
    {error||linkError?<DataError/>:!data?.length?<EmptyState title="You are all caught up">New order updates will appear here.</EmptyState>:<NotificationsClient rows={data.map(r=>({...r,order_href:r.order_id?links[r.order_id]??null:null}))}/>}
    <nav className="buyer-actions" aria-label="Notification pages">{page>1&&<Link className="buyer-btn" href={`/notifications?page=${page-1}`}>Previous</Link>}{(allRows?.length??0)>50&&<Link className="buyer-btn" href={`/notifications?page=${page+1}`}>Next</Link>}</nav>
  </BuyerPage>
}
