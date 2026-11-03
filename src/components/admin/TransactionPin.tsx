'use client'
import{useEffect,useRef,useState,type FormEvent}from'react'
import{createClient}from'@/lib/supabase/client'
import{reconcileFinanceJob}from'@/lib/paystack/actions'
import './transaction-pin.css'
type Operation='transfer'|'refund'|'approve_delivery'|'resolve_dispute'|'delivery_hold'|'cancel_transfer'|'retry_refund'
type Result={ok:true}|{error:string}
const labels:Record<Operation,string>={transfer:'Transfer approved earnings',refund:'Request refund',approve_delivery:'Approve vendor credit',resolve_dispute:'Resolve order dispute',delivery_hold:'Change delivery hold',cancel_transfer:'Cancel unsent transfer',retry_refund:'Retry rejected refund'}
export function useTransactionPin(){
 const[operation,setOperation]=useState<{name:Operation;payload:Record<string,unknown>}|null>(null),[pin,setPin]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false)
 const resolver=useRef<((r:Result)=>void)|null>(null),dialog=useRef<HTMLDialogElement>(null)
 function finish(result:Result){resolver.current?.(result);resolver.current=null;setOperation(null);setPin('');setError('');setUncertain(false)}
 useEffect(()=>{if(operation&&!dialog.current?.open)dialog.current?.showModal()},[operation])
 useEffect(()=>()=>{resolver.current?.({error:'The PIN review was closed.'});resolver.current=null},[])
 function authorize(name:Operation,payload:Record<string,unknown>):Promise<Result>{
  if(resolver.current)return Promise.resolve({error:'Complete the open PIN review first.'})
  setPin('');setError('');setUncertain(false);setOperation({name,payload});return new Promise(resolve=>{resolver.current=resolve})
 }
 async function submit(e:FormEvent){e.preventDefault();if(!operation||busy||uncertain||pin.length!==6)return;setBusy(true);setError('')
  try{const result=await createClient().rpc('cm_admin_finance_decision',{p_operation:operation.name,p_payload:operation.payload,p_pin:pin}).abortSignal(AbortSignal.timeout(20000));setPin('')
   if(result.error){if(result.error.code==='P0001'){setError(result.error.message);return}setUncertain(true);setError('The result could not be confirmed. Close this review, refresh the existing records and reconcile before trying another transaction.');return}
   if(result.data?.ok!==true){setError(result.data?.error??'The transaction PIN could not be checked.');return}
   // Dispatch only the recorded job. The PIN is never sent to a Next server action.
   if(['transfer','refund','retry_refund'].includes(operation.name)&&typeof result.data.result==='string'){
    try{await reconcileFinanceJob({kind:operation.name==='transfer'?'transfer':'refund',id:result.data.result})}catch{/* The durable job remains recorded. */}
   }
   finish({ok:true})
  }catch{setPin('');setUncertain(true);setError('The result could not be confirmed. Close this review and check existing records before retrying.')}finally{setBusy(false)}
 }
 const prompt=operation?<dialog ref={dialog} className="ap-pin-dialog" aria-labelledby="transaction-pin-title" onCancel={e=>{e.preventDefault();if(!busy)finish({error:'Operation cancelled; no new decision was submitted.'})}}>
 <form className="buyer-stack" onSubmit={submit}><h2 id="transaction-pin-title">{labels[operation.name]}</h2><p>Enter your transaction PIN to confirm the decision you just reviewed. This PIN applies to this decision only.</p>
 <label>Transaction PIN<input className="buyer-input" type="password" inputMode="numeric" autoComplete="off" autoFocus required maxLength={6} pattern="[0-9]{6}" value={pin} disabled={busy||uncertain} onChange={e=>setPin(e.target.value.replace(/[^0-9]/g,''))}/></label>
 {error&&<p role="alert" className="buyer-notice is-error">{error}</p>}
 <div className="buyer-actions"><button className="buyer-btn is-primary" disabled={busy||uncertain||pin.length!==6}>{busy?'Confirming...':'Confirm with PIN'}</button><button type="button" className="buyer-btn" disabled={busy} onClick={()=>finish({error:'PIN review closed. Refresh existing records if a result was uncertain.'})}>Cancel</button></div><a href="/admin-security?pin=1">Set up or change transaction PIN</a></form>
 </dialog>:null
 return{authorize,prompt}
}
