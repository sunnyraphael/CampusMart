import PublicPhoto from './PublicPhoto'
import Link from 'next/link'
import { BadgeCheck, Package, Star, Store } from 'lucide-react'
import { DeliveryLine, ListingChips, PriceBlock, PromoCorner } from '@/components/store/ListingBits'
import CardAddButton from '@/components/store/CardAddButton'
import FavoriteButton from '@/components/buyer/FavoriteButton'
import { listingImages } from '@/lib/buyer/images'

// One listing card. It lives in its own file (not inside the page component) so React keeps
// the same component between renders instead of rebuilding every card each time (issue 77).
export type ProductCardData = {
  id: string
  title: string
  price: number
  images: unknown
  avg_rating: number | null
  total_reviews: number | null
  stock_quantity: number
  compare_at_price: number | null
  sale_ends_at: string | null
  condition: string | null
  availability: string | null
  delivery_days: number | null
  categories: { name: string; slug: string } | null
  sellers: { store_name: string; is_verified: boolean | null } | null
}

export default function ProductCard({
  product,
  showCategory = true,
}: {
  product: ProductCardData
  showCategory?: boolean
}) {
  const src = listingImages(product.images)[0]??null
  const rated = (product.total_reviews??0)>0 && product.avg_rating != null && product.avg_rating >= 1 && product.avg_rating <= 5
  const vendor = product.sellers?.store_name ?? null

  return (
    <article className="pc lift">
      <div className="pc-save"><FavoriteButton productId={product.id} /></div>
      {/* The link wraps only the photo and text. The cart button is a sibling, because a button inside a link is invalid HTML. */}
      <Link href={`/products/${product.id}`} className="pc-link">
        <div className="pc-photo">
          {src ? (
            <PublicPhoto key={src} src={src} alt={product.title}/>
          ) : (
            <Package size={32} strokeWidth={1.5} aria-hidden="true" />
          )}
          <PromoCorner product={product} />
        </div>

        <div className="pc-body">
          {showCategory && product.categories?.name && (
            <span className="pc-cat">{product.categories.name}</span>
          )}
          <span className="pc-title">{product.title}</span>
          {rated && (
            <span className="pc-rating">
              <Star size={12} aria-hidden="true" />
              <span>{product.avg_rating!.toFixed(1)}</span>
              {!!product.total_reviews && <span className="pc-reviews">({product.total_reviews})</span>}
            </span>
          )}
          <ListingChips product={product} />
          <DeliveryLine product={product} />
          {vendor && (
            <span className="pc-vendor">
              <Store size={12} strokeWidth={1.75} aria-hidden="true" />
              <span className="pc-vendor-name">{vendor}</span>
              {product.sellers?.is_verified && (
                <>
                  <BadgeCheck size={14} strokeWidth={1.75} className="pc-verified" aria-hidden="true" />
                  <span className="sr-only">Verified vendor</span>
                </>
              )}
            </span>
          )}
        </div>
      </Link>

      <div className="pc-foot">
        <Link href={`/products/${product.id}`} className="pc-price" aria-label={`View ${product.title}`}>
          <PriceBlock product={product} />
        </Link>
        <CardAddButton
          id={product.id}
          title={product.title}
          price={product.price}
          imageUrl={src}
          vendorName={vendor}
          stock={product.stock_quantity}
        />
      </div>
    </article>
  )
}
