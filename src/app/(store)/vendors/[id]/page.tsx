import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CARD_SELECT } from '@/lib/buyer/server'
import { listingImages } from '@/lib/buyer/images'
import { uuid } from '@/lib/buyer/validation'
import { DataError, EmptyState } from '@/components/buyer/Page'
import StartChatButton from '@/components/buyer/StartChatButton'
import ProductCard, { type ProductCardData } from '@/components/store/ProductCard'
import FeeDisclosure from '@/components/store/FeeDisclosure'

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
  return <section className="buyer-page sh-storefront">
    <header className="sh-store-hero"><div className="sh-store-avatar">{listingImages([vendor.logo_url])[0]?<img referrerPolicy="no-referrer" src={vendor.logo_url} alt=""/>:<Store size={32} strokeWidth={1.5} aria-hidden/>}</div><div className="sh-store-copy"><span className="sh-eyebrow">Campus vendor</span><h1>{vendor.store_name}</h1><p>{[vendor.campus,vendor.state].filter(Boolean).join(', ')||'Location not provided'}</p>{vendor.is_verified&&<span className="sh-verified"><BadgeCheck size={16} aria-hidden/>Verified vendor</span>}</div><div className="buyer-actions"><StartChatButton vendorId={id}/><Link className="buyer-btn" href="/products">All listings</Link></div></header>
    <section className="buyer-panel sh-store-about"><h2>About the store</h2><p className="buyer-preserve-lines">{vendor.description||'The vendor has not added a store description. Explore available listings below or message them with a question.'}</p></section>
    <section className="buyer-stack"><div className="sh-section-top"><div><span className="sh-eyebrow">Explore this store</span><h2>Available listings</h2></div><span className="buyer-help">{rows.length>24?'24+':rows.length} on this page</span></div><FeeDisclosure/>{products.error?<DataError/>:!rows.length?<EmptyState title="No listings on this page">This vendor may be restocking. You can still message them.</EmptyState>:<div className="pl-grid">{rows.slice(0,24).map(p=><ProductCard key={p.id} product={p}/>)}</div>}</section>
    <nav className="buyer-actions" aria-label="Vendor listing pages">{page>1&&<Link className="buyer-btn" href={`/vendors/${id}?page=${page-1}`}>Previous</Link>}{rows.length>24&&<Link className="buyer-btn" href={`/vendors/${id}?page=${page+1}`}>Next</Link>}</nav>
  </section>
}
