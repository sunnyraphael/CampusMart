import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CARD_SELECT } from '@/lib/buyer/server'
import { listingImages } from '@/lib/buyer/images'
import { uuid } from '@/lib/buyer/validation'
import { BuyerPage, DataError, EmptyState } from '@/components/buyer/Page'
import StartChatButton from '@/components/buyer/StartChatButton'
import ProductCard, { type ProductCardData } from '@/components/store/ProductCard'

export default async function VendorPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}) {
  const {id}=await params
  if(!uuid.safeParse(id).success)notFound()
  const page=Math.min(10000,Math.max(1,parseInt((await searchParams).page??'1',10)||1))
  const supabase=await createClient()
  const {data:vendor,error}=await supabase.from('public_vendors').select('id,store_name,description,logo_url,is_verified,campus,state').eq('id',id).maybeSingle()
  if(error)return <DataError/>
  if(!vendor)notFound()
  const products=await supabase.from('products').select(CARD_SELECT).eq('seller_id',id).eq('status','active').gt('stock_quantity',0).order('created_at',{ascending:false}).order('id').range((page-1)*24,page*24)
  const rows=(products.data??[]) as unknown as ProductCardData[]
  return <BuyerPage title={vendor.store_name} description={[vendor.campus,vendor.state].filter(Boolean).join(', ')||'Campus vendor'} actions={<StartChatButton vendorId={id}/>}>
    <section className="buyer-panel"><div className="buyer-actions">{listingImages([vendor.logo_url])[0]?<img className="buyer-store-logo" src={vendor.logo_url} alt={`${vendor.store_name} logo`}/>:<Store size={24} aria-hidden="true"/>}{vendor.is_verified&&<span className="buyer-status is-good"><BadgeCheck size={16} aria-hidden="true"/> Verified vendor</span>}</div><p>{vendor.description||'Explore this vendor’s available listings below.'}</p></section>
    {products.error?<DataError/>:!rows.length?<EmptyState title="No listings on this page">This vendor may be restocking. You can still message them.</EmptyState>:<div className="pl-grid">{rows.slice(0,24).map((p)=><ProductCard key={p.id} product={p}/>)}</div>}
    <nav className="buyer-actions" aria-label="Vendor listing pages">{page>1&&<Link className="buyer-btn" href={`/vendors/${id}?page=${page-1}`}>Previous</Link>}{rows.length>24&&<Link className="buyer-btn" href={`/vendors/${id}?page=${page+1}`}>Next</Link>}</nav>
  </BuyerPage>
}
