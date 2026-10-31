import Link from 'next/link'
import { Package } from 'lucide-react'
import ItemActions from '@/app/(store)/orders/ItemActions'
import StartChatButton from './StartChatButton'
import { formatPrice } from '@/lib/utils/format'
import { listingImages } from '@/lib/buyer/images'

export type BuyerOrderItem = {id:string;quantity:number;unit_price:number;subtotal:number;product_id:string|null;seller_id:string|null;fulfillment_status?:string;auto_release_at?:string|null;expected_by?:string|null;dispute_reason?:string|null;products:{title:string;images:unknown}|null}
export type BuyerOrder = {id:string;created_at:string|null;status:string;payment_status:string|null;total_amount:number;delivery_address:string|null;delivery_notes?:string|null;order_items:BuyerOrderItem[]}
const stages:Record<string,{name:string;tone:string}>={pending:{name:'Waiting for vendor',tone:''},confirmed:{name:'Vendor confirmed',tone:''},shipped:{name:'On the way',tone:''},delivered:{name:'Confirm receipt',tone:'is-warn'},received:{name:'Completed',tone:'is-good'},disputed:{name:'Disputed',tone:'is-bad'},refunded:{name:'Refund approved',tone:'is-warn'},cancelled:{name:'Cancelled',tone:'is-bad'}}

export default function OrderCard({order,detail=false}:{order:BuyerOrder;detail?:boolean}) {
  const paid=order.payment_status==='paid'
  return <article className="buyer-panel buyer-stack" id={`order-${order.id}`}>
    <header className="buyer-row"><div><h2>Order {order.id.slice(0,8).toUpperCase()}</h2><time className="buyer-time">{order.created_at?new Date(order.created_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'}):''}</time></div><span className={`buyer-status ${paid?'is-good':'is-warn'}`}>{paid?'Paid':order.payment_status==='refunded'?'Refunded':'Payment not completed'}</span></header>
    <div className="order-items">{order.order_items.map((item)=>{
      const image=listingImages(item.products?.images)[0]
      const stage=stages[item.fulfillment_status??'pending']??{name:'Processing',tone:''}
      return <section className="order-item" key={item.id}>
        {image?<img className="order-item-photo" src={image} alt=""/>:<Package className="order-item-photo" size={32} aria-hidden="true"/>}
        <div><h3>{item.product_id?<Link href={`/products/${item.product_id}`}>{item.products?.title??'Purchased item'}</Link>:item.products?.title??'Purchased item'}</h3><p>{item.quantity} × {formatPrice(item.unit_price)} · {formatPrice(item.subtotal)}</p><span className={`buyer-status ${stage.tone}`}>{stage.name}</span>
          {item.expected_by&&<p>Expected by {new Date(item.expected_by).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos'})}</p>}
          {paid&&item.fulfillment_status==='delivered'&&<p>Inspect your item before confirming receipt.{item.auto_release_at&&` Automatic release is scheduled for ${new Date(item.auto_release_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'})}.`}</p>}
          {item.fulfillment_status==='disputed'&&<p className="buyer-notice">Your report: {item.dispute_reason||'Under review'}. The vendor payout is on hold while this is reviewed.</p>}
          {paid&&<ItemActions itemId={item.id} status={item.fulfillment_status??'pending'}/>}
          <div className="order-item-actions">{item.seller_id&&<StartChatButton vendorId={item.seller_id}/>}<Link className="buyer-btn" href="/contact">Get help</Link>{paid&&item.fulfillment_status==='received'&&item.product_id&&<Link className="buyer-btn" href={`/products/${item.product_id}#reviews`}>Review item</Link>}</div>
        </div>
      </section>
    })}</div>
    <footer className="buyer-row"><div><p className="buyer-help">{order.delivery_address||'Campus pickup'}</p>{order.delivery_notes&&<p className="buyer-help">{order.delivery_notes}</p>}</div><strong>Total {formatPrice(order.total_amount)}</strong>{!detail&&<Link className="buyer-btn" href={`/orders/${order.id}`}>Order details</Link>}</footer>
  </article>
}
