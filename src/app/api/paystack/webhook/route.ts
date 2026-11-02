import { createHash } from 'node:crypto'
import { paymentConfig,paymentService } from '@/lib/paystack/config'
import { validSignature } from '@/lib/paystack/protocol'
import { verifyPayment,processRefund } from '@/lib/paystack'
import { processTransfer } from '@/lib/paystack/transfers'
export const runtime='nodejs'
export async function POST(request:Request){
  try{
    if(Number(request.headers.get('content-length')??0)>262144)return new Response('Too large',{status:413})
    const reader=request.body?.getReader();if(!reader)return new Response('Missing body',{status:400})
    const chunks:Uint8Array[]=[];let size=0
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return new Response('Too large',{status:413})}chunks.push(value)}
    const raw=Buffer.concat(chunks).toString('utf8'),config=paymentConfig()
    if(!validSignature(raw,request.headers.get('x-paystack-signature'),config.key))return new Response('Invalid signature',{status:401})
    const event=JSON.parse(raw) as {event?:string;data?:{reference?:string;transaction?:{reference?:string}|number;id?:number}}
    if(typeof event.event!=='string'||event.event.length>100)return new Response('Invalid event',{status:400})
    const service=paymentService(),id=createHash('sha256').update(raw).digest('hex')
    const reference=event.data?.reference??(typeof event.data?.transaction==='object'?event.data.transaction.reference:undefined)
    const stored=await service.from('paystack_events').upsert({id,event:event.event,reference:reference?.slice(0,100)??null},{onConflict:'id',ignoreDuplicates:true})
    if(stored.error)throw new Error('Event storage unavailable')
    const previous=await service.from('paystack_events').select('processed_at').eq('id',id).single()
    if(previous.error)throw new Error('Event lookup unavailable')
    if(previous.data.processed_at)return new Response('OK')
    if(event.event==='charge.success'&&reference&&/^cm-[a-f0-9]{32}$/.test(reference)){
      const known=await service.from('paystack_payments').select('reference').eq('reference',reference).maybeSingle()
      if(known.error)throw new Error('Payment lookup unavailable')
      if(known.data)await verifyPayment(reference)
    }
    else if(event.event.startsWith('refund.')&&event.data?.id){
      const job=await service.from('paystack_refunds').select('id').eq('provider_id',String(event.data.id)).maybeSingle()
      if(job.error)throw new Error('Refund lookup unavailable')
      if(job.data)await processRefund(job.data.id)
      // If POST-result persistence raced this event, cron reconciles by merchant-note marker.
    }else if(event.event.startsWith('transfer.')&&reference){
      const job=await service.from('paystack_transfers').select('id').eq('reference',reference).maybeSingle()
      if(job.error)throw new Error('Transfer lookup unavailable')
      if(job.data)await processTransfer(job.data.id)
    }else if(event.event.startsWith('charge.dispute.')){
      let ref=reference
      if(!ref&&typeof event.data?.transaction==='number'){
        const p=await service.from('paystack_payments').select('reference').eq('provider_id',String(event.data.transaction)).maybeSingle();if(p.error)throw p.error;ref=p.data?.reference
      }
      if(ref){const result=await service.rpc('cm_paystack_hold',{p_reference:ref});if(result.error)throw result.error}
    }
    const saved=await service.from('paystack_events').update({processed_at:new Date().toISOString()}).eq('id',id)
    if(saved.error)throw new Error('Event completion unavailable')
    return new Response('OK')
  }catch{return new Response('Retry later',{status:503})}
}
