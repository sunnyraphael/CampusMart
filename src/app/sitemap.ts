import type {MetadataRoute} from 'next'
import {siteOrigin} from '@/lib/seo/metadata'
export const revalidate=900
async function publicRows(table:string,query:string):Promise<{id:string}[]>{
 const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
 if(!origin||!key)return []
 try{const r=await fetch(origin+'/rest/v1/'+table+'?select=id&'+query+'&order=id&limit=1000',{headers:{apikey:key,Authorization:'Bearer '+key},next:{revalidate:900},signal:AbortSignal.timeout(8000)});if(!r.ok)return [];const rows=await r.json();return Array.isArray(rows)?rows:[]}catch{return []}
}
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const base=siteOrigin(),paths=['','/products','/categories','/deals','/help','/how-it-works','/contact','/privacy','/terms','/vendor-terms','/refunds','/cookies']
 const [products,vendors]=await Promise.all([publicRows('products','status=eq.active&stock_quantity=gt.0'),publicRows('public_vendors','')])
 return [...paths.map(path=>({url:base+path})),...products.map(p=>({url:base+'/products/'+p.id})),...vendors.map(v=>({url:base+'/vendors/'+v.id}))]
}
