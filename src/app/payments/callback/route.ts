import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paymentConfig,paymentService } from '@/lib/paystack/config'
import { verifyPayment } from '@/lib/paystack'
export const runtime='nodejs'
export async function GET(request:Request){
  const url=new URL(request.url),reference=url.searchParams.get('reference')
  // Next's internal request URL can use localhost behind a proxy. Redirect to
  // the configured public origin so the buyer retains the correct auth cookies.
  let origin:string
  try{origin=paymentConfig().origin}catch{return new Response('Payment configuration unavailable. Open My orders to check your payment.',{status:503})}
  if(!reference||!/^cm-[a-f0-9]{32}$/.test(reference))return NextResponse.redirect(new URL('/orders',origin))
  const {data:{user}}=await(await createClient()).auth.getUser()
  if(!user)return NextResponse.redirect(new URL(`/login?redirectTo=${encodeURIComponent('/payments/callback?reference='+reference)}`,origin))
  let orderId:string|undefined
  try{
    const payment=await paymentService().from('paystack_payments').select('order_id').eq('reference',reference).eq('user_id',user.id).maybeSingle()
    orderId=payment.data?.order_id
    if(orderId)await verifyPayment(reference,{throttle:true})
  }catch{/* The owned order page offers a retry; a callback never proves payment. */}
  return NextResponse.redirect(new URL(orderId?`/orders/${orderId}?payment=check`:'/orders',origin))
}
