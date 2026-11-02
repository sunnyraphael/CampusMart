import 'server-only'
import { paymentConfig,paymentService } from './config'
import { ProviderRequestError } from './protocol'
type Transfer={id:string;reference:string;mode:string;state:string;amount_kobo:number;recipient_code:string;provider_code:string|null}
type ProviderTransfer={reference:string;amount:number;currency:string;domain?:string;status:string;transfer_code:string;recipient:string|{recipient_code:string}}
export async function processTransfer(id:string){
  const service=paymentService(),config=paymentConfig()
  const lookup=await service.from('paystack_transfers').select('*').eq('id',id).single()
  const job=lookup.data as Transfer|null
  if(lookup.error||!job||job.mode!==config.mode)throw new Error('Transfer unavailable in this payment environment')
  if(['reversed','failed','abandoned','blocked'].includes(job.state))return
  let response:ProviderTransfer
  if(job.state!=='queued')response=await config.api<ProviderTransfer>(`/transfer/verify/${encodeURIComponent(job.reference)}`)
  else{
    // Check the delivery hold again at dispatch time. Claim and authorization
    // are atomic inside the service RPC, not a browser-supplied flag.
    const claim=await service.rpc('cm_claim_paystack_transfer',{p_id:job.id})
    if(claim.error)throw new Error('Transfer claim unavailable')
    if(claim.data!==true)return
    try{response=await config.api<ProviderTransfer>('/transfer',{source:'balance',amount:Number(job.amount_kobo),recipient:job.recipient_code,reference:job.reference,reason:'CampusMart approved delivery earnings'})}
    catch(error){
      await service.rpc('cm_paystack_transfer_result',{p_id:job.id,p_code:null,p_state:error instanceof ProviderRequestError&&error.rejected?'failed':'uncertain'})
      throw new Error('Transfer result uncertain. Reconcile the existing reference; do not create another transfer.')
    }
  }
  const recipient=typeof response.recipient==='object'?response.recipient.recipient_code:response.recipient
  if(response.reference!==job.reference||Number(response.amount)!==Number(job.amount_kobo)||response.currency!=='NGN'||recipient!==job.recipient_code||(response.domain&&response.domain!==job.mode))throw new Error('Transfer verification mismatch')
  const saved=await service.rpc('cm_paystack_transfer_result',{p_id:job.id,p_code:response.transfer_code,p_state:response.status})
  if(saved.error)throw new Error('Transfer state could not be recorded')
}
