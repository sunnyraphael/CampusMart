import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Star, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CARD_SELECT } from '@/lib/buyer/server'
import { uuid } from '@/lib/buyer/validation'
import { listingImages } from '@/lib/buyer/images'
import { BuyerPage, DataError } from '@/components/buyer/Page'
import FavoriteButton from '@/components/buyer/FavoriteButton'
import StartChatButton from '@/components/buyer/StartChatButton'
import ReviewForm from '@/components/buyer/ReviewForm'
import ProductCard, { type ProductCardData } from '@/components/store/ProductCard'
import { PriceBlock, ListingChips, DeliveryLine } from '@/components/store/ListingBits'
import type { ProductFull } from '@/types'
import ProductGallery from './ProductGallery'
import AddToCartButton from './AddToCartButton'

type Detail=ProductFull & {sellers:ProductFull['sellers'] & {id:string;description:string|null}}
type Review={id:string;user_id:string;rating:number;comment:string|null;created_at:string|null}

export default async function ProductPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!uuid.safeParse(id).success)notFound()
  const supabase=await createClient()
  const {data,error}=await supabase.from('products').select('*,sellers:public_vendors(id,store_name,logo_url,is_verified,description),categories(name,slug)').eq('id',id).eq('status','active').maybeSingle()
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
  return <BuyerPage title={product.title} description={product.categories?.name??'Campus listing'} actions={<Link href="/products" className="buyer-btn">All listings</Link>}>
    <div className="buyer-columns"><ProductGallery images={product.images} title={product.title}/><section className="buyer-panel buyer-stack">
      <div className="product-detail-price"><PriceBlock product={product} showSaleEnd badge/></div>
      <div className="buyer-actions"><span className={`buyer-status ${product.stock_quantity>0?'is-good':'is-warn'}`}>{product.stock_quantity>0?`${product.stock_quantity} in stock`:'Out of stock'}</span>{(product.total_reviews??0)>0&&<span className="buyer-help">{Number(product.avg_rating??0).toFixed(1)} / 5 ({product.total_reviews} reviews)</span>}</div>
      <ListingChips product={product} showNew lowStock={false}/><DeliveryLine product={product} variant="long"/>
      <AddToCartButton product={product}/>
      <div className="buyer-actions"><FavoriteButton productId={id} label/>{product.sellers&&<StartChatButton vendorId={product.sellers.id} productId={id}/>}</div>
      {product.sellers&&<Link href={`/vendors/${product.sellers.id}`} className="buyer-link">{listingImages([product.sellers.logo_url])[0]?<img className="buyer-store-logo" src={product.sellers.logo_url!} alt=""/>:<Store size={20} aria-hidden="true"/>}<span>{product.sellers.store_name}{product.sellers.is_verified&&<span className="buyer-help"> ? Verified vendor</span>}</span></Link>}
      <p className="buyer-help">Check the item and delivery details with the vendor before ordering. Only confirm receipt after inspecting your purchase.</p>
    </section></div>
    <section className="buyer-panel"><h2>About this item</h2><p className="buyer-preserve-lines">{product.description||'The vendor has not added a description. Message them if you need more details.'}</p>{product.categories&&<Link className="buyer-btn" href={`/products?category=${encodeURIComponent(product.categories.slug)}`}>More in {product.categories.name}</Link>}</section>
    <section className="buyer-panel buyer-stack" id="reviews"><h2>Customer reviews</h2>{reviews.error?<DataError/>:reviewRows.length?reviewRows.map((r)=><article key={r.id} className="buyer-review"><div className="buyer-row"><span className="buyer-actions"><Star size={16} aria-hidden="true"/>{r.rating} / 5{r.user_id===user?.id?' ? Your review':''}</span><time className="buyer-time">{r.created_at?new Date(r.created_at).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos'}):''}</time></div>{r.comment&&<p className="buyer-preserve-lines">{r.comment}</p>}</article>):<p>No reviews yet.</p>}
      {(product.total_reviews??0)>20&&<p className="buyer-help">Showing the latest 20 reviews. The overall rating includes every review.</p>}
      {eligible?<ReviewForm productId={id} rating={mine?.rating} comment={mine?.comment??''}/>:<p className="buyer-help">Buyers can leave a review after receiving a paid order.</p>}
    </section>
    {related.error?<DataError/>:!!related.data?.length&&<section className="buyer-stack"><h2>You might also like</h2><div className="pl-grid">{(related.data as unknown as ProductCardData[]).map((p)=><ProductCard key={p.id} product={p}/>)}</div></section>}
  </BuyerPage>
}
