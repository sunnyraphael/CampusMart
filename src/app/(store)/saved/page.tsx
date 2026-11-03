import Link from 'next/link'
import { BuyerPage, DataError, EmptyState } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import { buildProductsHref, parseSort } from '@/lib/products-query'
import SavedSearchRemove from './Remove'

export default async function SavedSearchesPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=Math.max(1,Math.min(10000,parseInt((await searchParams).page??'1')||1))
  const { supabase, user } = await buyerSession('/saved')
  const { data, error } = await supabase.from('saved_searches').select('id,name,query,category,sort').eq('user_id', user.id).order('created_at', { ascending: false }).order('id').range((page-1)*25,page*25)
  return <BuyerPage title="Saved searches" description="Return to your favorite searches with the same category and sort order.">
    {error ? <DataError /> : !data?.length ? <EmptyState title="Your next find starts with a search">Search for an item, then choose Save search on the listings page.</EmptyState> : <div className="buyer-stack">{data.slice(0,25).map((s) => <div className="buyer-panel buyer-row" key={s.id}>
      <div className="buyer-row-text"><h2>{s.name}</h2><p>{s.category || 'All categories'} · {s.sort.replaceAll('_',' ')}</p></div>
      <div className="buyer-actions"><Link className="buyer-btn" href={buildProductsHref({ q:s.query, category:s.category, sort:parseSort(s.sort) })}>View results</Link><SavedSearchRemove id={s.id} /></div>
    </div>)}</div>}
    <nav className="buyer-actions" aria-label="Saved search pages">{page>1&&<Link className="buyer-btn" href={`/saved?page=${page-1}`}>Previous</Link>}{(data?.length??0)>25&&<Link className="buyer-btn" href={`/saved?page=${page+1}`}>Next</Link>}</nav>
  </BuyerPage>
}
