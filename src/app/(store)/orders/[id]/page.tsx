import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buyerSession } from '@/lib/buyer/server'
import { uuid } from '@/lib/buyer/validation'
import { BuyerPage, DataError } from '@/components/buyer/Page'
import OrderCard, { type BuyerOrder } from '@/components/buyer/OrderCard'

export default async function OrderPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!uuid.safeParse(id).success)notFound()
  const {supabase,user}=await buyerSession(`/orders/${id}`)
  const {data,error}=await supabase.from('orders').select('*,order_items(*,products(title,images))').eq('id',id).eq('user_id',user.id).maybeSingle()
  if(error)return <DataError/>
  if(!data)notFound()
  return <BuyerPage title="Order details" description="Payment status and progress for each item in your order." actions={<Link className="buyer-btn" href="/orders">All orders</Link>}><OrderCard order={data as unknown as BuyerOrder} detail/></BuyerPage>
}
