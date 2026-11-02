'use client'
import { useEffect,useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { checkOrderPayment } from '@/app/(checkout)/checkout/payment-actions'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/utils/format'
export type PaymentSummary={reference:string;mode:'test'|'live';state:string;amount:number;refunds:{id:string;amount:number;status:string;processing_fee_retained:number}[]}
export default function PaymentStatus({orderId,payment}:{orderId:string;payment:PaymentSummary}){
  const router=useRouter(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  useEffect(()=>{
    if(payment.state!=='paid')return
    try{
      const stored=JSON.parse(sessionStorage.getItem('campusmart-payment-cart')??'null') as {orderId:string;items:{product_id:string;quantity:number}[]}|null
      if(stored?.orderId!==orderId||!Array.isArray(stored.items))return
      const bought=new Map(stored.items.map(i=>[i.product_id,i.quantity]))
      useCartStore.setState(s=>({items:s.items.flatMap(i=>{const left=i.quantity-(bought.get(i.id)??0);return left>0?[{...i,quantity:left}]:[]})}))
      sessionStorage.removeItem('campusmart-payment-cart');sessionStorage.removeItem('campusmart-payment-checkout')
    }catch{/* Browser storage may be blocked; the payment is still recorded on the server. */}
  },[orderId,payment.state])
  async function check(){setBusy(true);setNotice('');try{const result=await checkOrderPayment(orderId);setNotice('error'in result?result.error:result.state==='verified'?'Payment verified.':'Payment is pending or under review. Do not pay again.');router.refresh()}catch{setNotice("Payment status could not be checked. Please retry; do not pay again.")}finally{setBusy(false)}}
  return <section className="buyer-panel buyer-stack" aria-label="Payment and refund status">
    <h2>{payment.mode==='test'?'Paystack TEST payment':'Your payment'}</h2>
    {payment.mode==='test'&&<p className="buyer-notice">Test mode: no real money, stock sale or vendor wallet credit. Do not fulfil this as a real purchase.</p>}
    <p>Status: <strong>{payment.state==='paid'?'Verified':payment.state==='review'?'Under review':payment.state==='expired'?'Reservation expired':payment.state}</strong> · {formatPrice(payment.amount)}</p>
    <p className="buyer-help">Reference: <code>{payment.reference}</code></p>
    {payment.state!=='paid'&&payment.state!=='refunded'&&<button className="buyer-btn" disabled={busy} onClick={()=>void check()}>{busy?'Checking…':'Check payment status'}</button>}
    {notice&&<p role="status" className="buyer-notice">{notice}</p>}
    {payment.refunds.map(refund=><div key={refund.id} className="buyer-notice"><p>Refund {formatPrice(refund.amount)}: <strong>{refund.status==='uncertain'||refund.status==='submitting'?'Awaiting reconciliation':refund.status}</strong>. {refund.status==='processed'?'Paystack confirmed processing; your bank may take additional time.':'This does not confirm money has reached your bank.'}</p>{refund.processing_fee_retained>0&&<p>Reviewed processing-fee deduction: {formatPrice(refund.processing_fee_retained)}.</p>}</div>)}
    <Link className="buyer-help" href="/contact">Payment or refund help</Link>
  </section>
}
