import Link from 'next/link'
import ProductCard, { type ProductCardData } from '@/components/store/ProductCard'
import { BuyerPage, DataError, EmptyState } from '@/components/buyer/Page'
import { createClient } from '@/lib/supabase/server'
import { CARD_SELECT } from '@/lib/buyer/server'
import { getPromo } from '@/lib/listing-display'

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.min(10000, Math.max(1, parseInt((await searchParams).page ?? '1', 10) || 1))
  const supabase = await createClient()
  const { data, error } = await supabase.from('products').select(CARD_SELECT).eq('status', 'active').gt('stock_quantity', 0).not('compare_at_price', 'is', null)
    .or(`sale_ends_at.is.null,sale_ends_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false }).order('id').range((page - 1) * 24, page * 24)
  const rows = (data ?? []) as unknown as ProductCardData[]
  const products = rows.slice(0,24).filter((p) => getPromo(p))
  return <BuyerPage title="Campus deals" description="Current offers from campus vendors. Only active, in-stock promotions appear here.">
    {error ? <DataError /> : products.length ? <div className="pl-grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div> : <EmptyState title="No deals on this page">Explore all listings or check back when vendors add new offers.</EmptyState>}
    <nav className="buyer-actions" aria-label="Deals pages">{page > 1 && <Link className="buyer-btn" href={`/deals?page=${page-1}`}>Previous</Link>}{rows.length > 24 && <Link className="buyer-btn" href={`/deals?page=${page+1}`}>Next</Link>}</nav>
  </BuyerPage>
}
