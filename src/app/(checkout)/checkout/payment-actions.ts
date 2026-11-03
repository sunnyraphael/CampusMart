'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { trialOrderSchema } from '@/lib/orders/trial'
import { paymentConfig,paymentService } from '@/lib/paystack/config'
import { safeCheckoutUrl } from '@/lib/paystack/protocol'
import { verifyPayment,processRefund, type Payment } from '@/lib/paystack'

export async function beginPaystackCheckout(input:unknown):Promise<{url:string;orderId:string}|{error:string}>{
  if(typeof input!=='object'||input===null||!('orderTermsAccepted'in input)||input.orderTermsAccepted!==true)return {error:'Review the total and accept the order terms.'}
  const parsed=trialOrderSchema.safeParse(input)
  if(!parsed.success)return {error:parsed.error.issues[0]?.message??'Check your order details.'}
  try{
    const config=paymentConfig(),service=paymentService(),supabase=await createClient()
    const auth=await supabase.auth.getUser()
    if(auth.error||!auth.data.user)return {error:'Sign in before starting a payment.'}
    const available=await supabase.rpc('cm_checkout_available')
    if(available.error||available.data!==true)return {error:'Ordering is temporarily unavailable. Your cart is saved; please try again later.'}
    const permission=await supabase.rpc('cm_consent_status')
    if(permission.error||permission.data?.eligible!==true||permission.data?.age_band!=='adult')return {error:'Paid checkout currently requires an eligible adult account. Contact support about guardian-supported payments.'}
    const v=parsed.data
    const order=await service.rpc('cm_create_paystack_order',{p_user_id:auth.data.user.id,p_request_id:v.requestId,p_items:v.items,p_delivery_method:v.deliveryMethod,p_address:v.address,p_phone:v.phone,p_note:v.note,p_expected_total:v.expectedTotal,p_mode:config.mode,p_retain_fee:true})
    if(order.error)return {error:order.error.code==='P0001'?order.error.message:'Payment checkout setup is unavailable. No payment has been confirmed. Contact support.'}
    const payment=order.data as Payment
    if(payment.state==='paid')return {url:`/orders/${payment.order_id}`,orderId:payment.order_id}
    if(new Date(payment.expires_at).getTime()<=Date.now())return {error:'This payment reservation expired. Start a new checkout after checking My orders.'}
    if(payment.authorization_url)return {url:safeCheckoutUrl(payment.authorization_url),orderId:payment.order_id}
    const claim=await service.from('paystack_payments').update({state:'pending'}).eq('order_id',payment.order_id).eq('state','created').select('order_id')
    if(claim.error||!claim.data?.length)return {error:'This checkout is already being initialized or needs reconciliation. Open My orders to check it before trying another payment.'}
    const response=await config.api<{authorization_url:string;reference:string}>('/transaction/initialize',{reference:payment.reference,email:payment.email,amount:Number(payment.amount_kobo),currency:'NGN',callback_url:`${config.origin}/payments/callback`,metadata:{order_id:payment.order_id}})
    if(response.reference!==payment.reference)throw new Error('Payment reference mismatch')
    const url=safeCheckoutUrl(response.authorization_url)
    const stored=await service.from('paystack_payments').update({authorization_url:url}).eq('order_id',payment.order_id)
    if(stored.error)throw new Error('Payment checkout could not be saved')
    revalidatePath('/orders')
    return {url,orderId:payment.order_id}
  }catch{return {error:'Payment initialization could not be confirmed. Open My orders and check payment status before starting another checkout.'}}
}

export async function checkOrderPayment(orderId:string):Promise<{state:string}|{error:string}>{
  if(!/^[a-f0-9-]{36}$/i.test(orderId))return {error:'Invalid order reference.'}
  try{
    const auth=await(await createClient()).auth.getUser()
    if(!auth.data.user)return {error:'Sign in to check your payment.'}
    const payment=await paymentService().from('paystack_payments').select('reference').eq('order_id',orderId).eq('user_id',auth.data.user.id).maybeSingle()
    if(payment.error||!payment.data)return {error:'This payment is not available.'}
    const result=await verifyPayment(payment.data.reference)
    revalidatePath(`/orders/${orderId}`);revalidatePath('/orders')
    return {state:result.state}
  }catch{return {error:'Payment status could not be confirmed. Do not pay again; retry this check or contact support.'}}
}

export async function cancelPaidOrder(orderId:string,reason:string){
  if(!/^[a-f0-9-]{36}$/i.test(orderId)||typeof reason!=='string'||reason.length>500)return {error:'Check the order reference and cancellation reason.'}
  try{
    const supabase=await createClient(),auth=await supabase.auth.getUser()
    if(!auth.data.user)return {error:'Sign in to cancel your order.'}
    const cancelled=await supabase.rpc('cm_cancel_buyer_order',{p_order_id:orderId,p_reason:reason||null})
    if(cancelled.error)return {error:cancelled.error.code==='P0001'?cancelled.error.message:'Cancellation could not be confirmed. Refresh before retrying.'}
    const service=paymentService()
    const owned=await service.from('paystack_payments').select('order_id').eq('order_id',orderId).eq('user_id',auth.data.user.id).maybeSingle()
    if(owned.data){
      const jobs=await service.from('paystack_refunds').select('id').eq('order_id',orderId).eq('dedup_key','cancel:'+orderId)
      for(const job of jobs.data??[]){try{await processRefund(job.id)}catch{/* Queued or uncertain job is durable; cron/admin reconciles it. */}}
    }
    revalidatePath(`/orders/${orderId}`);revalidatePath('/orders');revalidatePath('/vendor/orders');revalidatePath('/admin/payments')
    return {quote:cancelled.data}
  }catch{return {error:'The result could not be confirmed. Refresh the order to check cancellation and refund status.'}}
}
