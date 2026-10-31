import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buyerSession } from '@/lib/buyer/server'
import { uuid } from '@/lib/buyer/validation'
import { BuyerPage, DataError } from '@/components/buyer/Page'
import OrderCard, { type BuyerOrder } from '@/components/buyer/OrderCard'
import OrderRefresh from '@/components/orders/OrderRefresh'
import type { OrderTracking } from '@/lib/orders/tracking'

export default async function OrderPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!uuid.safeParse(id).success)notFound()
  const {supabase,user}=await buyerSession(`/orders/${id}`)
  const {data,error}=await supabase.from('orders').select('*,order_items(*,products(title,images))').eq('id',id).eq('user_id',user.id).maybeSingle()
  if(error)return <DataError/>
  if(!data)notFound()
  const tracking=await supabase.rpc('cm_order_tracking',{p_order_id:id})
  return <BuyerPage title="Order details" description="Payment status and progress for each item in your order." actions={<><OrderRefresh/><Link className="buyer-btn" href="/orders">All orders</Link></>}>
    {tracking.error&&<DataError message="Your order is available, but its tracking updates could not load. Please retry or contact support."/>}
    <OrderCard order={data as unknown as BuyerOrder} detail tracking={(tracking.data??[]) as OrderTracking[]}/>
  </BuyerPage>
}
