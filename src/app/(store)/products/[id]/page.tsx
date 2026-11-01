import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Star, Store, BadgeCheck, ChevronRight, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CARD_SELECT } from '@/lib/buyer/server'
import { uuid } from '@/lib/buyer/validation'
import { listingImages } from '@/lib/buyer/images'
import { DataError } from '@/components/buyer/Page'
import FavoriteButton from '@/components/buyer/FavoriteButton'
import StartChatButton from '@/components/buyer/StartChatButton'
import ReviewForm from '@/components/buyer/ReviewForm'
import ProductCard, { type ProductCardData } from '@/components/store/ProductCard'
import { PriceBlock, ListingChips, DeliveryLine } from '@/components/store/ListingBits'
import type { ProductFull } from '@/types'
import ProductGallery from './ProductGallery'
import AddToCartButton from './AddToCartButton'
import ShoppingHeading from '@/components/store/ShoppingHeading'
import FeeDisclosure from '@/components/store/FeeDisclosure'

type Detail=ProductFull & {sellers:ProductFull['sellers'] & {id:string;description:string|null}}
type Review={id:string;user_id:string;rating:number;comment:string|null;created_at:string|null}

export default async function ProductPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!uuid.safeParse(id).success)notFound()
  const supabase=await createClient()
  const {data,error}=await supabase.from('products').select('id,seller_id,category_id,title,description,price,images,avg_rating,total_reviews,stock_quantity,status,created_at,compare_at_price,sale_ends_at,condition,availability,delivery_days,sellers:public_vendors(id,store_name,logo_url,is_verified,description),categories(name,slug)').eq('id',id).eq('status','active').maybeSingle()
  if(error)return <DataError/>
  if(!data)notFound()
  const product=data as unknown as Detail
  product.images=listingImages(product.images)
  const [reviews,related,{data:{user}}]=await Promise.all([
    supabase.from('reviews').select('id,user_id,rating,comment,created_at').eq('product_id',id).order('created_at',{ascending:false}).limit(20),
    product.category_id?supabase.from('products').select(CARD_SELECT).eq('category_id',product.category_id).eq('status','active').gt('stock_quantity',0).neq('id',id).order('created_at',{ascending:false}).limit(4):Promise.resolve({data:[],error:null}),
    supabase.auth.getUser(),
  ])
  let eligible=false
  if(user) {
    const purchase=await supabase.from('order_items').select('id,orders!inner(user_id,payment_status)').eq('product_id',id).eq('fulfillment_status','received').eq('orders.user_id',user.id).eq('orders.payment_status','paid').limit(1)
    eligible=!purchase.error&&!!purchase.data?.length
  }
  const reviewRows=(reviews.data??[]) as Review[]
  const mine=user?reviewRows.find((r)=>r.user_id===user.id):undefined
  const rated=(product.total_reviews??0)>0&&Number(product.avg_rating)>=1&&Number(product.avg_rating)<=5
  return <section className="buyer-page sh-product">
    <nav className="sh-breadcrumb" aria-label="Breadcrumb"><Link href="/products">All listings</Link><ChevronRight size={13} aria-hidden/>{product.categories?<><Link href={`/products?category=${encodeURIComponent(product.categories.slug)}`}>{product.categories.name}</Link><ChevronRight size={13} aria-hidden/></>:null}<span>Item details</span></nav>
    <ShoppingHeading eyebrow={product.categories?.name??'Campus listing'} title={product.title} description="Review the item, ask questions and choose what works for you." actions={<div className="buyer-actions"><a className="buyer-btn" href="#about-item">Item details</a><a className="buyer-btn" href="#reviews">Reviews</a></div>}/>
    <div className="buyer-columns sh-product-columns"><ProductGallery images={product.images} title={product.title}/><section className="buyer-panel buyer-stack sh-product-summary" aria-label="Price and buying options">
      <div className="sh-product-meta"><span className={`buyer-status ${product.stock_quantity>0?'is-good':'is-warn'}`}>{product.stock_quantity>0?`${product.stock_quantity} in stock`:'Out of stock'}</span>{rated?<a href="#reviews" className="sh-product-rating"><Star size={15} aria-hidden/>{Number(product.avg_rating).toFixed(1)} <span>({product.total_reviews} reviews)</span></a>:<a href="#reviews" className="buyer-help">{(product.total_reviews??0)>0?'Rating unavailable':'No ratings yet'}</a>}</div>
      <div className="product-detail-price"><PriceBlock product={product} showSaleEnd badge/></div>
      <ListingChips product={product} showNew lowStock={false}/><DeliveryLine product={product} variant="long"/>
      <p className="buyer-help">Delivery timing is a vendor estimate. Confirm the details before ordering.</p>
      <AddToCartButton product={product}/>
      <div className="buyer-actions sh-product-secondary"><FavoriteButton productId={id} label/>{product.sellers&&<StartChatButton vendorId={product.sellers.id} productId={id}/>}</div>
      <FeeDisclosure compact/>
      {product.sellers&&<Link href={`/vendors/${product.sellers.id}`} className="sh-vendor-link">{listingImages([product.sellers.logo_url])[0]?<img referrerPolicy="no-referrer" className="buyer-store-logo" src={product.sellers.logo_url!} alt=""/>:<span className="sh-shortcut-icon"><Store size={20} aria-hidden/></span>}<span><small>Sold by</small><strong>{product.sellers.store_name}</strong>{product.sellers.is_verified&&<span className="sh-verified"><BadgeCheck size={14} aria-hidden/>Verified vendor</span>}</span><ChevronRight size={17} aria-hidden/></Link>}
      <p className="buyer-help">Inspect your purchase before confirming receipt. Need help? <Link href="/refunds">Read the refund policy</Link> or <Link href="/contact">contact support</Link>.</p>
    </section></div>
    <div className="sh-detail-columns"><section className="buyer-panel buyer-stack" id="about-item"><span className="sh-eyebrow">Get to know the item</span><h2>About this item</h2><p className="buyer-preserve-lines">{product.description||'The vendor has not added a description. Message them if you need more details.'}</p>{product.categories&&<Link className="sh-text-link" href={`/products?category=${encodeURIComponent(product.categories.slug)}`}>More in {product.categories.name}<ChevronRight size={15} aria-hidden/></Link>}</section><aside className="buyer-panel buyer-stack sh-purchase-guide"><MessageCircle size={25} strokeWidth={1.5} aria-hidden/><h2>A quick conversation helps</h2><p className="buyer-help">Ask about condition, what is included and the pickup or delivery arrangement. Keep conversations on CampusMart so you can refer to them later.</p><Link className="sh-text-link" href="/help">Visit the help centre <ChevronRight size={15} aria-hidden/></Link></aside></div>
    <section className="buyer-panel buyer-stack sh-reviews" id="reviews"><div className="sh-section-top"><div><span className="sh-eyebrow">From the community</span><h2>Buyer reviews</h2></div><span className="sh-review-total">{product.total_reviews??0} {(product.total_reviews??0)===1?'review':'reviews'}</span></div><p className="buyer-help">Review submission requires a received, paid purchase. Trial orders do not qualify.</p>{reviews.error?<DataError/>:reviewRows.length?reviewRows.map(r=><article key={r.id} className="buyer-review"><div className="buyer-row"><span className="buyer-actions"><Star size={16} aria-hidden/>{r.rating} / 5{r.user_id===user?.id?' - Your review':''}</span><time className="buyer-time">{r.created_at?new Date(r.created_at).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos'}):''}</time></div>{r.comment&&<p className="buyer-preserve-lines">{r.comment}</p>}</article>):<div className="sh-review-empty"><Star size={26} strokeWidth={1.3} aria-hidden/><h3>No reviews yet</h3><p>No buyer feedback has been published for this item.</p></div>}
      {(product.total_reviews??0)>20&&<p className="buyer-help">Showing the latest 20 reviews. The overall rating includes every review.</p>}
      {eligible?<ReviewForm productId={id} rating={mine?.rating} comment={mine?.comment??''}/>:<p className="buyer-help">Buyers can leave a review after receiving a paid order.</p>}
    </section>
    {related.error?<DataError/>:!!related.data?.length&&<section className="buyer-stack"><div className="sh-section-top"><div><span className="sh-eyebrow">Keep exploring</span><h2>More in this category</h2></div><Link className="sh-text-link" href={`/products?category=${encodeURIComponent(product.categories?.slug??'')}`}>View category <ChevronRight size={15} aria-hidden/></Link></div><div className="pl-grid">{(related.data as unknown as ProductCardData[]).map(p=><ProductCard key={p.id} product={p}/>)}</div></section>}
  </section>
}
