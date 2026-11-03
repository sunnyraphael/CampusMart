import 'server-only'
import { paymentConfig, paymentService } from './config'
import { matchesCharge,ProviderRequestError, type VerifiedCharge } from './protocol'
import { processTransfer } from './transfers'

export type Payment={order_id:string;user_id:string;reference:string;amount_kobo:number;email:string;mode:'test'|'live';state:string;provider_id:string|null;expires_at:string;authorization_url:string|null}
type Refund={id:string;order_id:string;amount_kobo:number;state:string;provider_id:string|null}
type ProviderRefund={id:number;amount:number;currency:string|null;status:string;merchant_note?:string;transaction:number|{id:number;reference:string;domain:string;currency?:string}}

export async function verifyPayment(reference:string,{throttle=false}:{throttle?:boolean}={}){
  if(!/^cm-[a-f0-9]{32}$/.test(reference))throw new Error('Invalid payment reference')
  const service=paymentService(),config=paymentConfig()
  const lookup=await service.from('paystack_payments').select('*').eq('reference',reference).maybeSingle()
  if(lookup.error)throw new Error('Payment lookup unavailable')
  const payment=lookup.data as Payment|null
  if(!payment||payment.mode!==config.mode)throw new Error('Payment environment mismatch')
  if(throttle){
    const claim=await service.rpc('cm_claim_payment_check',{p_reference:reference})
    if(claim.error)throw new Error('Payment check security is unavailable')
    if(claim.data!==true)return {orderId:payment.order_id,state:payment.state==='paid'?'verified':payment.state==='review'?'review':'pending'}
  }
  const charge=await config.api<VerifiedCharge>(`/transaction/verify/${encodeURIComponent(reference)}`)
  if(charge.status==='reversed'){
    const held=await service.rpc('cm_paystack_hold',{p_reference:reference});if(held.error)throw held.error
    return {orderId:payment.order_id,state:'review'}
  }
  if(charge.status!=='success')return {orderId:payment.order_id,state:'pending'}
  if(!matchesCharge(charge,payment)){
    await service.rpc('cm_paystack_hold',{p_reference:reference})
    throw new Error('Payment verification mismatch')
  }
  const result=await service.rpc('cm_verify_paystack_payment',{p_reference:reference,p_provider_id:String(charge.id),p_amount:charge.amount,p_email:charge.customer.email,p_currency:charge.currency,p_mode:charge.domain,p_provider_fee:Number.isSafeInteger(charge.fees)?charge.fees:null})
  if(result.error)throw new Error('Payment could not be recorded')
  return {orderId:payment.order_id,state:'verified'}
}

async function saveRefund(job:Refund,refund:ProviderRefund,payment:Payment){
  const transaction=typeof refund.transaction==='object'?String(refund.transaction.id):String(refund.transaction)
  if(transaction!==String(payment.provider_id)||Number(refund.amount)!==Number(job.amount_kobo)||(refund.currency!==null&&refund.currency!=='NGN')||(typeof refund.transaction==='object'&&refund.transaction.currency&&refund.transaction.currency!=='NGN')||!Number.isSafeInteger(refund.id)||refund.id<=0)throw new Error('Refund verification mismatch')
  const allowed=['pending','processing','needs-attention','failed','processed']
  if(!allowed.includes(refund.status))throw new Error('Unknown provider refund status')
  const result=await paymentService().rpc('cm_paystack_refund_result',{p_id:job.id,p_provider_id:String(refund.id),p_state:refund.status})
  if(result.error)throw new Error('Refund status could not be recorded')
}

export async function processRefund(id:string,maxLookupPages=10){
  const service=paymentService(),config=paymentConfig()
  const row=await service.from('paystack_refunds').select('*').eq('id',id).maybeSingle()
  if(row.error||!row.data)throw new Error('Refund not found')
  const job=row.data as Refund
  const result=await service.from('paystack_payments').select('*').eq('order_id',job.order_id).single()
  const payment=result.data as Payment|null
  if(result.error||!payment||payment.mode!==config.mode||!payment.provider_id)throw new Error('Refund payment unavailable')
  if(job.state==='processed')return
  if(job.provider_id){await saveRefund(job,await config.api<ProviderRefund>(`/refund/${encodeURIComponent(job.provider_id)}`),payment);return}
  if(job.state!=='queued'){
    // The Refund API has no documented idempotency key. Never blindly repeat an
    // uncertain POST; reconcile using the job marker and original transaction.
    for(let page=1;page<=maxLookupPages;page++){
      const refunds=await config.api<ProviderRefund[]>(`/refund?transaction=${encodeURIComponent(payment.provider_id)}&perPage=100&page=${page}`)
      const matches=refunds.filter(refund=>refund.merchant_note===`CampusMart refund ${job.id}`)
      if(matches.length>1)throw new Error('Duplicate refunds require administrator review')
      if(matches[0]){await saveRefund(job,matches[0],payment);return}
      if(refunds.length<100)break
    }
    return // Remains uncertain, visible in admin. Do not issue another refund.
  }
  const claim=await service.from('paystack_refunds').update({state:'submitting',updated_at:new Date().toISOString()}).eq('id',job.id).eq('state','queued').select('id')
  if(claim.error)throw new Error('Refund claim unavailable')
  if(!claim.data?.length)return
  try{
    const refund=await config.api<ProviderRefund>('/refund',{transaction:payment.reference,amount:Number(job.amount_kobo),currency:'NGN',merchant_note:`CampusMart refund ${job.id}`,customer_note:'CampusMart order refund'})
    await saveRefund(job,refund,payment)
  }catch(error){
    // A timeout may have happened after Paystack accepted the refund.
    await service.from('paystack_refunds').update({state:error instanceof ProviderRequestError&&error.rejected?'rejected':'uncertain',updated_at:new Date().toISOString()}).eq('id',job.id).eq('state','submitting')
    throw new Error('Refund needs reconciliation. Do not create a duplicate refund.')
  }
}

export async function reconcilePayments(){
  const service=paymentService(),config=paymentConfig()
  const deadline=Date.now()+40000
  // Release due reservations in a bounded database-only batch before provider I/O.
  // A later successful charge follows the existing late-payment refund path.
  const expiration=await service.rpc('cm_expire_reservations',{p_mode:config.mode,p_limit:50})
  if(expiration.error)throw new Error('Reservation expiration unavailable')
  const pending=await service.from('paystack_payments').select('reference,expires_at').eq('mode',config.mode).in('state',['created','pending']).order('last_checked_at',{nullsFirst:true}).limit(2)
  if(pending.error)throw new Error('Payment queue unavailable')
  // Historical expired payments cannot starve active payments. Recheck recent
  // expirations separately, no more than once an hour per reference.
  const expired=await service.from('paystack_payments').select('reference,expires_at').eq('mode',config.mode).eq('state','expired').gte('created_at',new Date(Date.now()-7*86400000).toISOString()).or('last_checked_at.is.null,last_checked_at.lt.'+new Date(Date.now()-3600000).toISOString()).order('last_checked_at',{nullsFirst:true}).limit(1)
  if(expired.error)throw new Error('Expired payment review unavailable')
  let checked=0,failed=0
  for(const payment of [...(pending.data??[]),...(expired.data??[])]){
    if(Date.now()>=deadline)return {checked,failed}
    try{
      const verified=await verifyPayment(payment.reference)
      if(verified.state==='pending'&&new Date(payment.expires_at).getTime()<Date.now()){
        const expired=await service.rpc('cm_expire_paystack_payment',{p_reference:payment.reference});if(expired.error)throw expired.error
      }
      checked++
    }catch{failed++}finally{
      if(new Date(payment.expires_at).getTime()<Date.now())await service.rpc('cm_expire_paystack_payment',{p_reference:payment.reference})
      await service.from('paystack_payments').update({last_checked_at:new Date().toISOString()}).eq('reference',payment.reference)
    }
  }
  const refunds=await service.from('paystack_refunds').select('id,paystack_payments!inner(mode)').eq('paystack_payments.mode',config.mode).not('state','in','(processed,rejected)').order('updated_at').limit(2)
  if(refunds.error)throw new Error('Refund queue unavailable')
  for(const job of refunds.data??[]){
    if(Date.now()>=deadline)return {checked,failed}
    try{await processRefund(job.id,1);checked++}catch{failed++}finally{await service.from('paystack_refunds').update({updated_at:new Date().toISOString()}).eq('id',job.id)}
  }
  const transfers=await service.from('paystack_transfers').select('id').eq('mode',config.mode).in('state',['queued','submitting','pending','otp','uncertain']).order('updated_at').limit(2)
  if(transfers.error)throw new Error('Transfer queue unavailable')
  for(const job of transfers.data??[]){
    if(Date.now()>=deadline)return {checked,failed}
    try{await processTransfer(job.id);checked++}catch{failed++}finally{await service.from('paystack_transfers').update({updated_at:new Date().toISOString()}).eq('id',job.id)}
  }
  return {checked,failed}
}
