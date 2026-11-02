'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { useCartStore } from '@/store/cart'
import { useLiveListings } from '@/lib/useLiveListings'
import { useHydrated } from '@/hooks/useHydrated'
import { formatPrice } from '@/lib/utils/format'
import { calcServiceFee } from '@/lib/fees'
import { DeliveryLine, ListingChips, PriceBlock } from '@/components/store/ListingBits'
import { BuyerPage, EmptyState } from '@/components/buyer/Page'
import ServiceFeeNote from '@/components/ServiceFeeNote'
import { CheckoutSkeleton } from '@/components/loading/StoreSkeletons'
import { placeTrialOrder } from './actions'
import { trialCheckoutSchema } from '@/lib/orders/trial'
import { beginPaystackCheckout } from './payment-actions'

function checkoutNonce() {
  const bytes=crypto.getRandomValues(new Uint8Array(16))
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}

export default function CheckoutClient({trialEnabled=false,paystackMode=null}:{trialEnabled?:boolean;paystackMode?:'test'|'live'|null}) {
  const hydrated=useHydrated()
  const items=useCartStore((s)=>s.items)
  const {live,loading,error,retry}=useLiveListings(items.map((i)=>i.id))
  const [method,setMethod]=useState('pickup')
  const [address,setAddress]=useState('')
  const [phone,setPhone]=useState('')
  const [note,setNote]=useState('')
  const [agreed,setAgreed]=useState(false)
  const [busy,setBusy]=useState(false)
  const busyRef=useRef(false)
  const memoryAttempt=useRef<{fingerprint:string;id:string}|null>(null)
  const [submitError,setSubmitError]=useState('')
  const [receipt,setReceipt]=useState<{id:string;total:number}|null>(null)
  const ready=!loading&&!error
  const unavailable=ready&&items.some((i)=>!live[i.id]||live[i.id].status!=='active'||live[i.id].stock_quantity<i.quantity)
  const subtotal=Math.round(items.reduce((total,i)=>total+(live[i.id]?.price??i.price)*i.quantity,0)*100)/100
  const fee=calcServiceFee(subtotal)
  // Preview only. A future payment endpoint must calculate the authoritative delivery fee.
  const delivery=method==='delivery'?500:0
  async function submit() {
    if(!agreed){setSubmitError('Review the total and accept the order terms before continuing.');return}
    if(busyRef.current||!ready||unavailable||!items.length||(!trialEnabled&&!paystackMode))return
    const payload={items:items.map(i=>({product_id:i.id,quantity:i.quantity})).sort((a,b)=>a.product_id.localeCompare(b.product_id)),deliveryMethod:method,address:method==='delivery'?address.trim():'',phone:phone.trim(),note:note.trim(),expectedTotal:subtotal+fee+delivery}
    const checked=trialCheckoutSchema.safeParse(payload)
    if(!checked.success){setSubmitError(checked.error.issues[0]?.message??'Check your order details.');return}
    busyRef.current=true;setBusy(true);setSubmitError('')
    try {
      // Persist only a nonce and a digest, never the address/phone or delivery codes.
      const fingerprint=JSON.stringify({...payload,mode:paystackMode??'trial'})
      const digest=crypto.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint)))).map(b=>b.toString(16).padStart(2,'0')).join(''):null
      let attempt:{digest:string;id:string}|null=null
      const attemptKey=paystackMode?'campusmart-payment-checkout':'campusmart-trial-checkout'
      if(digest)try {attempt=JSON.parse(sessionStorage.getItem(attemptKey)??'null')}catch{}
      const requestId=digest&&attempt?.digest===digest&&attempt.id?attempt.id:memoryAttempt.current?.fingerprint===fingerprint?memoryAttempt.current.id:checkoutNonce()
      memoryAttempt.current={fingerprint,id:requestId}
      if(digest)try {sessionStorage.setItem(attemptKey,JSON.stringify({digest,id:requestId}))}catch{}
      if(paystackMode){
        const payment=await beginPaystackCheckout({...payload,requestId,orderTermsAccepted:agreed})
        if('error'in payment){setSubmitError(payment.error);return}
        try{sessionStorage.setItem('campusmart-payment-cart',JSON.stringify({orderId:payment.orderId,items:payload.items}))}catch{}
        window.location.assign(payment.url)
        return
      }
      const result=await placeTrialOrder({...payload,requestId,orderTermsAccepted:agreed})
      if('error'in result){setSubmitError(result.error);return}
      setReceipt(result)
      const bought=new Map(payload.items.map(i=>[i.product_id,i.quantity]))
      useCartStore.setState(s=>({items:s.items.flatMap(i=>{const left=i.quantity-(bought.get(i.id)??0);return left>0?[{...i,quantity:left}]:[]})}))
      try {sessionStorage.removeItem('campusmart-trial-checkout')}catch{}
    }catch{setSubmitError('Checkout could not finish. Check your connection and retry to check the order result.')}
    finally{busyRef.current=false;setBusy(false)}
  }
  if(!hydrated)return <CheckoutSkeleton trial={trialEnabled} paystackMode={paystackMode}/>
  if(receipt)return <BuyerPage title="Trial order created" description="Your test order is ready for the delivery workflow. No payment was collected."><section className="buyer-panel buyer-stack"><h2>Order #{receipt.id.slice(0,8).toUpperCase()}</h2><p>Trial total: <strong>{formatPrice(receipt.total)}</strong></p><p>Amount charged: <strong>{formatPrice(0)}</strong></p><p>Follow the vendor updates, generate your delivery code at handover and confirm receipt. Admin can then complete a trial approval. Real vendor balances stay unchanged.</p><div className="buyer-actions"><Link className="buyer-btn is-primary" href={`/orders/${receipt.id}`}>Track trial order</Link><Link className="buyer-btn" href="/products">Continue shopping</Link></div></section></BuyerPage>
  if(!items.length)return <BuyerPage title="Checkout" description="Add items to your cart before reviewing an order."><EmptyState title="Your cart is empty">Add items before checking out.</EmptyState></BuyerPage>
  return <BuyerPage title="Checkout" description="Review current prices, delivery details and your total." actions={<Link className="buyer-btn" href="/cart">Back to cart</Link>}>
    <div className="buyer-notice" role="status">{paystackMode==='live'?'You will pay on Paystack’s secure checkout. Your order is paid only after server verification.':paystackMode==='test'?'Paystack TEST checkout. Use Paystack test payment details only. No real money or vendor earnings will be created.':trialEnabled?'Trial checkout is on. This creates a test order for the delivery workflow. No payment is collected, no stock is reserved and no real vendor earnings are created.':'Online payment is not available yet. Your cart is saved and you have not been charged.'}</div>
    {paystackMode&&<p className="buyer-notice">For an eligible voluntary cancellation within 30 minutes, the CampusMart service fee ({formatPrice(fee)}) is retained; estimated refund: {formatPrice(subtotal+delivery)}. Dispatch or pickup readiness ends self-service cancellation. Late-delivery or dispute refunds are reviewed separately; an actual Paystack processing-fee deduction is considered only where lawful, and full statutory refunds are not reduced. <Link href="/refunds">Read the refund policy</Link>.</p>}
    {loading&&<p role="status">Checking the latest prices and stock...</p>}
    {error&&<div className="buyer-notice is-error" role="alert">{error}<button className="buyer-btn" onClick={retry}>Try again</button></div>}
    {unavailable&&<div className="buyer-notice is-error" role="alert">Some items are unavailable or exceed current stock. <Link href="/cart">Update your cart</Link> before continuing.</div>}
    <form onSubmit={e=>{e.preventDefault();void submit()}} className="buyer-columns"><section className="buyer-panel buyer-stack"><h2>Delivery details</h2><p className="buyer-help">Only your selected delivery details are shared for this order. Pickup does not require a home address. <Link href="/privacy">How we use order details</Link></p>
      <label className="buyer-label">Delivery method<select disabled={busy} className="buyer-input" value={method} onChange={(e)=>setMethod(e.target.value)}><option value="pickup">Campus pickup - free</option><option value="delivery">Campus delivery - estimated {formatPrice(500)}</option></select></label>
      {method==='delivery'&&<label className="buyer-label">Delivery address<textarea disabled={busy} className="buyer-input" value={address} onChange={(e)=>setAddress(e.target.value)} required={trialEnabled||!!paystackMode} minLength={5} maxLength={500} placeholder="Hall, room or campus meeting point"/></label>}
      <label className="buyer-label">Contact phone<input disabled={busy} required={trialEnabled||!!paystackMode} className="buyer-input" type="tel" autoComplete="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} maxLength={14} placeholder="08012345678"/></label>
      <label className="buyer-label">Note for the vendor (optional)<textarea disabled={busy} className="buyer-input" value={note} onChange={(e)=>setNote(e.target.value)} maxLength={1000}/></label>
    </section><section className="buyer-panel buyer-stack"><h2>Order summary</h2>{items.map((item)=>{
      const listing=live[item.id]
      return <div key={item.id} className="buyer-stack"><strong>{item.title}</strong><span className="buyer-help">Quantity {item.quantity}</span><PriceBlock product={listing??{price:item.price,stock_quantity:0}}/>{listing&&<><ListingChips product={listing}/><DeliveryLine product={listing} variant="long"/></>}</div>
    })}<div className="buyer-row"><span>Items</span><strong>{formatPrice(subtotal)}</strong></div><div className="buyer-row"><span>Service fee</span><span>{formatPrice(fee)}</span></div><div className="buyer-row"><span>Estimated delivery</span><span>{formatPrice(delivery)}</span></div><div className="buyer-row"><strong>Estimated total</strong><strong>{formatPrice(subtotal+fee+delivery)}</strong></div><ServiceFeeNote subtotal={subtotal}/><label className="by-check"><input type="checkbox" checked={agreed} required onChange={e=>setAgreed(e.target.checked)}/><span>I have reviewed the item, service and delivery amounts and agree to the <Link href="/terms">order terms</Link> and <Link href="/refunds">refund policy</Link>. {paystackMode?"I understand the disclosed service fee is retained for an eligible voluntary cancellation; statutory remedies are assessed separately.":"This trial does not collect payment."}</span></label><button type="submit" className="buyer-btn is-primary" disabled={(!trialEnabled&&!paystackMode)||busy||!ready||unavailable||!agreed}>{busy?'Preparing checkout...':paystackMode==='test'?'Paystack test payment':paystackMode==='live'?'Pay with Paystack':trialEnabled?'Place trial order':'Payment unavailable'}</button>{submitError&&<div className="buyer-notice is-error" role="alert">{submitError}<button type="button" className="buyer-btn" disabled={busy} onClick={retry}>Refresh prices</button></div>}<p className="buyer-help">{paystackMode?'Paystack processes your payment details. Do not enter card information in a CampusMart message.':trialEnabled?'Trial amounts are for testing only. This button does not charge your card or credit a real wallet.':'The final amount will be confirmed before any payment is made.'}</p></section></form>
  </BuyerPage>
}
