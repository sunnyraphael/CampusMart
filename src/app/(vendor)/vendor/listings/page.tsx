import Link from 'next/link'
import {vendorSession} from '@/lib/vendor/server'
import VendorListingsClient from './VendorListingsClient'
export default async function VendorListingsPage({searchParams}:{searchParams:Promise<{created?:string;updated?:string;stock?:string;status?:string;q?:string;sort?:string;page?:string}>}){
  const params=await searchParams,{supabase,seller}=await vendorSession('/vendor/listings')
  const page=Math.max(1,Math.min(10000,parseInt(params.page??'1')||1)),q=(params.q??'').trim().slice(0,80),status=['active','draft'].includes(params.status??'')?params.status!:'all',stock=['low','out'].includes(params.stock??'')?params.stock!:'all',sort=['price-asc','price-desc','stock'].includes(params.sort??'')?params.sort!:'newest'
  let query=supabase.from('products').select('id,title,price,images,status,stock_quantity,created_at,compare_at_price,sale_ends_at,availability',{count:'exact'}).eq('seller_id',seller.id)
  if(status!=='all')query=query.eq('status',status)
  if(q)query=query.ilike('title','%'+q.replace(/[\\%_]/g,'\\$&')+'%')
  if(stock!=='all'){query=query.or('availability.is.null,availability.neq.pre_order').lte('stock_quantity',stock==='out'?0:3);if(stock==='low')query=query.eq('status','active')}
  query=sort==='price-asc'?query.order('price'):sort==='price-desc'?query.order('price',{ascending:false}):sort==='stock'?query.order('stock_quantity'):query.order('created_at',{ascending:false})
  const [products,counts]=await Promise.all([query.order('id').range((page-1)*24,page*24-1),supabase.rpc('cm_vendor_listing_counts')])
  if(products.error||counts.error)throw new Error('Could not load your listings.')
  const href=(next:number)=>'/vendor/listings?'+new URLSearchParams({q,status,stock,sort,page:String(next)}).toString()
  // eslint-disable-next-line react-hooks/purity -- Stable server request timestamp.
  const requestTime=Date.now()
  return <><VendorListingsClient key={status+'-'+stock+'-'+page+'-'+sort+'-'+q} products={products.data??[]} now={requestTime} notice={params.created?'created':params.updated?'updated':null} initialFilter={status as 'all'|'active'|'draft'} initialStock={stock as 'all'|'low'|'out'} initialQuery={q} initialSort={sort as 'newest'|'price-asc'|'price-desc'|'stock'} summary={counts.data}/><nav className="buyer-actions" aria-label="Listing pages"><span>Page {page} - {products.count??0} matching listings</span>{page>1&&<Link className="buyer-btn" href={href(page-1)}>Previous</Link>}{page*24<(products.count??0)&&<Link className="buyer-btn" href={href(page+1)}>Next</Link>}</nav></>
}
