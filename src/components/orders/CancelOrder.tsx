'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Undo2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Quote={cancelled:boolean;can_cancel:boolean;reason?:string;deadline?:string;is_trial?:boolean;refund_status?:string;refund_amount:number;retained_service_fee:number}
export default function CancelOrder({orderId}:{orderId:string}) {
  const router=useRouter()
  const [open,setOpen]=useState(false)
  const [quote,setQuote]=useState<Quote|null>(null)
  const [reason,setReason]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [refreshing,startTransition]=useTransition()
  async function load(){
    setOpen(true);setBusy(true);setQuote(null);setError('')
    try{
      const result=await createClient().rpc('cm_order_cancellation_quote',{p_order_id:orderId})
      if(result.error){setError('Cancellation options could not load. Retry, or contact support.');return}
      setQuote(result.data as Quote)
    }catch{setError('Check your connection and try again.')}finally{setBusy(false)}
  }
  async function cancel(){
    if(busy||refreshing||!quote?.can_cancel)return
    setBusy(true);setError('')
    try{
      const result=await createClient().rpc('cm_cancel_buyer_order',{p_order_id:orderId,p_reason:reason.trim()||null})
      if(result.error){setError(result.error.code==='P0001'?result.error.message:'Cancellation could not be confirmed. Retry to check its result, or refresh your order.');return}
      setQuote(result.data as Quote)
      startTransition(()=>router.refresh())
    }catch{setError('The connection was interrupted. Retry or refresh the order to check whether cancellation completed.')}finally{setBusy(false)}
  }
  return <Dialog.Root open={open} onOpenChange={value=>{if(!busy)setOpen(value)}}>
    <button type="button" className="buyer-btn" onClick={()=>void load()}><Undo2 size={16} aria-hidden/>Cancellation options</button>
    <Dialog.Portal><Dialog.Overlay className="by-cancel-overlay"/><Dialog.Content className="by-cancel-dialog">
      <Dialog.Title>{quote?.cancelled?'Order cancelled':'Cancel this order?'}</Dialog.Title>
      <Dialog.Description>Self-service cancellation is available within 30 minutes of placing an order, before dispatch or pickup readiness. Returns and problems with an item are handled separately.</Dialog.Description>
      {busy&&!quote&&<p role="status">Checking your order…</p>}
      {quote?.cancelled?<p role="status" className="buyer-notice">Trial order cancelled. No payment was collected, no service fee was retained and no bank refund is needed.</p>:quote?.can_cancel?<>
        <p className="buyer-notice">This is a trial order. Refund: ₦0. Service fee retained: ₦0. No money was charged. Cancellation stops every item in this order.</p>
        {quote.deadline&&<p className="buyer-help">Cancel before {new Date(quote.deadline).toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'})} (Lagos time). Availability is checked again when you confirm.</p>}
        <label className="buyer-form">Reason (optional)<textarea className="buyer-input" rows={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <div className="buyer-actions"><button className="buyer-btn is-danger" disabled={busy||refreshing} onClick={()=>void cancel()}>{busy?'Cancelling…':'Confirm cancellation'}</button><Dialog.Close className="buyer-btn" disabled={busy}>Keep order</Dialog.Close></div>
      </>:quote&&<p className="buyer-notice">{quote.reason}</p>}
      {error&&<p role="alert" className="ot-error">{error}</p>}
      {error&&<button className="buyer-btn" disabled={busy} onClick={()=>void load()}>Retry check</button>}
      <p className="buyer-help"><Link href="/refunds">Refund & cancellation policy</Link> · <Link href="/contact">Contact support</Link></p>
      <Dialog.Close className="by-cancel-close" aria-label="Close cancellation options" disabled={busy}><X size={20} aria-hidden/></Dialog.Close>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
}
