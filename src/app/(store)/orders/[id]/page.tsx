import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buyerSession } from '@/lib/buyer/server'
import { uuid } from '@/lib/buyer/validation'
import { BuyerPage, DataError } from '@/components/buyer/Page'
import OrderCard, { type BuyerOrder } from '@/components/buyer/OrderCard'
import OrderRefresh from '@/components/orders/OrderRefresh'
import type { OrderTracking } from '@/lib/orders/tracking'
import PaymentStatus, {type PaymentSummary} from '@/components/orders/PaymentStatus'

export default async function OrderPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!uuid.safeParse(id).success)notFound()
  const {supabase,user}=await buyerSession(`/orders/${id}`)
  const {data,error}=await supabase.from('orders').select('id,is_trial,payment_environment,created_at,status,payment_status,total_amount,delivery_address,delivery_method,delivery_notes,order_items(id,quantity,unit_price,subtotal,product_id,seller_id,fulfillment_status,released_at,dispute_reason,products(title,images))').eq('id',id).eq('user_id',user.id).maybeSingle()
  if(error)return <DataError/>
  if(!data)notFound()
  const tracking=await supabase.rpc('cm_order_tracking',{p_order_id:id})
  const payment=await supabase.rpc('cm_payment_summary',{p_order_id:id})
  return <BuyerPage title="Order details" description="Payment status and progress for each item in your order." actions={<><OrderRefresh/><Link className="buyer-btn" href="/orders">All orders</Link></>}>
    {tracking.error&&<DataError message="Your order is available, but its tracking updates could not load. Please retry or contact support."/>}
    {payment.data&&<PaymentStatus orderId={id} payment={payment.data as PaymentSummary}/>}
    {data.payment_environment&&payment.error&&<DataError message="Payment and refund status could not load. Do not pay again; refresh or contact support."/>}
    <OrderCard order={data as unknown as BuyerOrder} detail tracking={(tracking.data??[]) as OrderTracking[]}/>
  </BuyerPage>
}
