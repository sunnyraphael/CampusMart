import Link from 'next/link'
import { BuyerPage, DataError, EmptyState } from '@/components/buyer/Page'
import OrderCard, { type BuyerOrder } from '@/components/buyer/OrderCard'
import { buyerSession } from '@/lib/buyer/server'

export default async function OrdersPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=Math.min(10000,Math.max(1,parseInt((await searchParams).page??'1',10)||1))
  const {supabase,user}=await buyerSession('/orders')
  const {data,error}=await supabase.from('orders').select('*,order_items(*,products(title,images))').eq('user_id',user.id).order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20)
  const rows=(data??[]) as unknown as BuyerOrder[]
  return <BuyerPage title="My orders" description="Track each item, confirm delivery, or report an issue from one place.">
    {error?<DataError/>:!rows.length?<EmptyState title={page>1?'No more orders':'No orders yet'}>Your purchases will appear here after an order is created.</EmptyState>:rows.slice(0,20).map((o)=><OrderCard key={o.id} order={o}/>)}
    <nav className="buyer-actions" aria-label="Order pages">{page>1&&<Link className="buyer-btn" href={`/orders?page=${page-1}`}>Previous</Link>}{rows.length>20&&<Link className="buyer-btn" href={`/orders?page=${page+1}`}>Next</Link>}</nav>
  </BuyerPage>
}
