import 'server-only'
import type {createClient} from '@/lib/supabase/server'
export type PurchaseReview={product_id:string;rating:number;comment:string|null}
export async function purchaseReviews(supabase:Awaited<ReturnType<typeof createClient>>,userId:string,productIds:string[]):Promise<PurchaseReview[]|null>{
 const ids=[...new Set(productIds)],batches:string[][]=[]
 for(let n=0;n<ids.length;n+=100)batches.push(ids.slice(n,n+100))
 const results=await Promise.all(batches.map(batch=>supabase.from('reviews').select('product_id,rating,comment').eq('user_id',userId).in('product_id',batch).abortSignal(AbortSignal.timeout(8000))))
 return results.some(r=>r.error)?null:results.flatMap(r=>r.data??[]) as PurchaseReview[]
}
