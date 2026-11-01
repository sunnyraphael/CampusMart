import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paymentService } from '@/lib/paystack/config'
import { verifyPayment } from '@/lib/paystack'
export const runtime='nodejs'
export async function GET(request:Request){
  const url=new URL(request.url),reference=url.searchParams.get('reference')
  if(!reference||!/^cm_[a-f0-9]{32}$/.test(reference))return NextResponse.redirect(new URL('/orders',url.origin))
  const {data:{user}}=await(await createClient()).auth.getUser()
  if(!user)return NextResponse.redirect(new URL(`/login?redirectTo=${encodeURIComponent('/payments/callback?reference='+reference)}`,url.origin))
  let orderId:string|undefined
  try{
    const payment=await paymentService().from('paystack_payments').select('order_id').eq('reference',reference).eq('user_id',user.id).maybeSingle()
    orderId=payment.data?.order_id
    if(orderId)await verifyPayment(reference)
  }catch{/* The owned order page offers a retry; a callback never proves payment. */}
  return NextResponse.redirect(new URL(orderId?`/orders/${orderId}?payment=check`:'/orders',url.origin))
}
