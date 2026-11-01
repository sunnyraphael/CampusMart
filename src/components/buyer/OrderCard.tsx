import Link from 'next/link'
import { Package } from 'lucide-react'
import ItemActions from '@/app/(store)/orders/ItemActions'
import StartChatButton from './StartChatButton'
import { formatPrice } from '@/lib/utils/format'
import { listingImages } from '@/lib/buyer/images'
import TrackingTimeline from '@/components/orders/TrackingTimeline'
import BuyerDeliveryCode from '@/components/orders/BuyerDeliveryCode'
import CancelOrder from '@/components/orders/CancelOrder'
import type { OrderTracking } from '@/lib/orders/tracking'

export type BuyerOrderItem = {id:string;quantity:number;unit_price:number;subtotal:number;product_id:string|null;seller_id:string|null;fulfillment_status?:string;released_at?:string|null;expected_by?:string|null;dispute_reason?:string|null;products:{title:string;images:unknown}|null}
export type BuyerOrder = {id:string;is_trial?:boolean;created_at:string|null;status:string;payment_status:string|null;total_amount:number;delivery_address:string|null;delivery_method?:string;delivery_notes?:string|null;order_items:BuyerOrderItem[]}
const stages:Record<string,{name:string;tone:string}>={pending:{name:'Waiting for vendor',tone:''},confirmed:{name:'Preparing',tone:''},shipped:{name:'On the way / ready for pickup',tone:''},delivered:{name:'Confirm receipt',tone:'is-warn'},received:{name:'Receipt confirmed',tone:'is-good'},disputed:{name:'Disputed',tone:'is-bad'},refunded:{name:'Refund approved',tone:'is-warn'},cancelled:{name:'Cancelled',tone:'is-bad'}}

export default function OrderCard({order,detail=false,tracking=[]}:{order:BuyerOrder;detail?:boolean;tracking?:OrderTracking[]}) {
  const paid=order.payment_status==='paid'||order.is_trial===true
  return <article className="buyer-panel buyer-stack" id={`order-${order.id}`}>
    <header className="buyer-row"><div><h2>Order {order.id.slice(0,8).toUpperCase()}</h2><time className="buyer-time">{order.created_at?new Date(order.created_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'}):''}</time></div><span className={`buyer-status ${paid&&!order.is_trial?'is-good':'is-warn'}`}>{order.is_trial?'Trial · no charge':paid?'Paid':order.payment_status==='refunded'?'Refunded':'Payment not completed'}</span></header>
    {order.is_trial&&<p className="buyer-notice">Trial order for testing the delivery procedure. No payment was collected and no real vendor earnings will be created.</p>}
    {detail&&<div className="buyer-actions"><CancelOrder orderId={order.id}/>{order.status==='cancelled'&&<span className="buyer-status">Order cancelled</span>}</div>}
    <div className="order-items">{order.order_items.map((item)=>{
      const image=listingImages(item.products?.images)[0]
      const stage=stages[item.fulfillment_status??'pending']??{name:'Processing',tone:''}
      const tracked=tracking.find(t=>t.item_id===item.id)
      return <section className="order-item" key={item.id}>
        {image?<img referrerPolicy="no-referrer" className="order-item-photo" src={image} alt=""/>:<Package className="order-item-photo" size={32} aria-hidden="true"/>}
        <div><h3>{item.product_id?<Link href={`/products/${item.product_id}`}>{item.products?.title??'Purchased item'}</Link>:item.products?.title??'Purchased item'}</h3><p>{item.quantity} × {formatPrice(item.unit_price)} · {formatPrice(item.subtotal)}</p><span className={`buyer-status ${stage.tone}`}>{stage.name}</span>
          {item.expected_by&&<p>Expected by {new Date(item.expected_by).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos'})}</p>}
          {paid&&item.fulfillment_status==='delivered'&&<p>{order.is_trial?'Confirm receipt after the test handover. Admin can then complete a simulated approval.':'Inspect your item before confirming receipt. Vendor credit requires a separate admin approval.'}</p>}
          {item.fulfillment_status==='received'&&!item.released_at&&<p className="buyer-help">Receipt confirmed. Vendor credit is awaiting admin review.</p>}
          {item.fulfillment_status==='disputed'&&<p className="buyer-notice">Your report: {item.dispute_reason||'Under review'}. The vendor payout is on hold while this is reviewed.</p>}
        </div>
        <div className="order-item-progress">
          {tracked&&<TrackingTimeline tracking={tracked} pickup={order.delivery_method==='pickup'}/>}
          {paid&&detail&&['shipped','delivered','received'].includes(item.fulfillment_status??'')&&!item.released_at&&<BuyerDeliveryCode itemId={item.id} verified={!!tracked?.code_verified_at}/>}
          {paid&&<ItemActions itemId={item.id} status={item.fulfillment_status??'pending'} credited={!!item.released_at}/>}
          <div className="order-item-actions">{item.seller_id&&<StartChatButton vendorId={item.seller_id}/>}<Link className="buyer-btn" href="/contact">Get help</Link>{paid&&!order.is_trial&&item.fulfillment_status==='received'&&item.product_id&&<Link className="buyer-btn" href={`/products/${item.product_id}#reviews`}>Review item</Link>}</div>
        </div>
      </section>
    })}</div>
    <footer className="buyer-row"><div><p className="buyer-help">{order.delivery_address||'Campus pickup'}</p>{order.delivery_notes&&<p className="buyer-help">{order.delivery_notes}</p>}</div><strong>Total {formatPrice(order.total_amount)}</strong>{!detail&&<Link className="buyer-btn" href={`/orders/${order.id}`}>Track order</Link>}</footer>
  </article>
}
