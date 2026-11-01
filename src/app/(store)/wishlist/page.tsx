import ProductCard, { type ProductCardData } from '@/components/store/ProductCard'
import FavoriteButton from '@/components/buyer/FavoriteButton'
import { DataError, EmptyState } from '@/components/buyer/Page'
import { buyerSession, CARD_SELECT } from '@/lib/buyer/server'
import ShoppingHeading from '@/components/store/ShoppingHeading'
import Link from 'next/link'
import FeeDisclosure from '@/components/store/FeeDisclosure'

export default async function WishlistPage() {
  const { supabase, user } = await buyerSession('/wishlist')
  const { data: saved, error } = await supabase.from('wishlist').select('product_id').eq('user_id', user.id).order('saved_at', { ascending: false })
  const ids = [...new Set((saved ?? []).map((row) => row.product_id as string))]
  const result = ids.length ? await supabase.from('products').select(CARD_SELECT).in('id', ids).eq('status', 'active') : { data: [], error: null }
  const products = (result.data ?? []) as unknown as ProductCardData[]
  const byId = new Map(products.map((p) => [p.id, p]))
  return <section className="buyer-page sh-collection"><ShoppingHeading eyebrow="Your saved finds" title="Your favorites" description="A place for the listings you want to come back to. Review the current price and availability before ordering." actions={<Link className="buyer-btn" href="/products">Keep exploring</Link>}/><FeeDisclosure/>
    {error || result.error ? <DataError /> : ids.length === 0 ? <EmptyState title="Save something you like">Tap the heart on a listing to find it here later.</EmptyState> : <div className="pl-grid">
      {ids.map((id) => { const product = byId.get(id); return <div className="buyer-card-wrap" key={id}>
        {product ? <ProductCard product={product} /> : <div className="buyer-panel"><h2>Listing unavailable</h2><p>This vendor may have removed or unpublished the listing.</p></div>}
        <FavoriteButton productId={id} initialSaved label />
      </div> })}
    </div>}
  </section>
}
