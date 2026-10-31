'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useCartStore } from '@/store/cart'
import { useLiveListings } from '@/lib/useLiveListings'
import { useHydrated } from '@/hooks/useHydrated'
import { formatPrice } from '@/lib/utils/format'
import { calcServiceFee } from '@/lib/fees'
import { DeliveryLine, ListingChips, PriceBlock } from '@/components/store/ListingBits'
import { BuyerPage, EmptyState } from '@/components/buyer/Page'
import ServiceFeeNote from '@/components/ServiceFeeNote'
import { CheckoutSkeleton } from '@/components/loading/StoreSkeletons'

export default function CheckoutClient() {
  const hydrated=useHydrated()
  const items=useCartStore((s)=>s.items)
  const {live,loading,error,retry}=useLiveListings(items.map((i)=>i.id))
  const [method,setMethod]=useState('pickup')
  const [address,setAddress]=useState('')
  const [phone,setPhone]=useState('')
  const [note,setNote]=useState('')
  const ready=!loading&&!error
  const unavailable=ready&&items.some((i)=>!live[i.id]||live[i.id].status!=='active'||live[i.id].stock_quantity<i.quantity)
  const subtotal=items.reduce((total,i)=>total+(live[i.id]?.price??i.price)*i.quantity,0)
  const fee=calcServiceFee(subtotal)
  // Preview only. A future payment endpoint must calculate the authoritative delivery fee.
  const delivery=method==='delivery'?500:0
  if(!hydrated)return <CheckoutSkeleton />
  if(!items.length)return <EmptyState title="Your cart is empty">Add items before checking out.</EmptyState>
  return <BuyerPage title="Checkout" description="Review current prices, delivery details and your total." actions={<Link className="buyer-btn" href="/cart">Back to cart</Link>}>
    <div className="buyer-notice" role="status">Online payment is not available yet. Your cart is saved and you have not been charged.</div>
    {loading&&<p role="status">Checking the latest prices and stock...</p>}
    {error&&<div className="buyer-notice is-error" role="alert">{error}<button className="buyer-btn" onClick={retry}>Try again</button></div>}
    {unavailable&&<div className="buyer-notice is-error" role="alert">Some items are unavailable or exceed current stock. <Link href="/cart">Update your cart</Link> before continuing.</div>}
    <div className="buyer-columns"><section className="buyer-panel buyer-stack"><h2>Delivery details</h2>
      <label className="buyer-label">Delivery method<select className="buyer-input" value={method} onChange={(e)=>setMethod(e.target.value)}><option value="pickup">Campus pickup - free</option><option value="delivery">Campus delivery - estimated {formatPrice(500)}</option></select></label>
      {method==='delivery'&&<label className="buyer-label">Delivery address<textarea className="buyer-input" value={address} onChange={(e)=>setAddress(e.target.value)} maxLength={500} placeholder="Hall, room or campus meeting point"/></label>}
      <label className="buyer-label">Contact phone<input className="buyer-input" type="tel" autoComplete="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} maxLength={14} placeholder="08012345678"/></label>
      <label className="buyer-label">Note for the vendor (optional)<textarea className="buyer-input" value={note} onChange={(e)=>setNote(e.target.value)} maxLength={1000}/></label>
    </section><section className="buyer-panel buyer-stack"><h2>Order summary</h2>{items.map((item)=>{
      const listing=live[item.id]
      return <div key={item.id} className="buyer-stack"><strong>{item.title}</strong><span className="buyer-help">Quantity {item.quantity}</span><PriceBlock product={listing??{price:item.price,stock_quantity:0}}/>{listing&&<><ListingChips product={listing}/><DeliveryLine product={listing} variant="long"/></>}</div>
    })}<div className="buyer-row"><span>Items</span><strong>{formatPrice(subtotal)}</strong></div><div className="buyer-row"><span>Service fee</span><span>{formatPrice(fee)}</span></div><div className="buyer-row"><span>Estimated delivery</span><span>{formatPrice(delivery)}</span></div><div className="buyer-row"><strong>Estimated total</strong><strong>{formatPrice(subtotal+fee+delivery)}</strong></div><ServiceFeeNote subtotal={subtotal}/><button className="buyer-btn is-primary" disabled>Payment unavailable</button><p className="buyer-help">The final amount will be confirmed before any payment is made.</p></section></div>
  </BuyerPage>
}
