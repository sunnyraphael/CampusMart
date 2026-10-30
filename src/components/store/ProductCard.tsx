import Link from 'next/link'
import { BadgeCheck, Package, Star, Store } from 'lucide-react'
import { DeliveryLine, ListingChips, PriceBlock, PromoCorner } from '@/components/store/ListingBits'
import CardAddButton from '@/components/store/CardAddButton'

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

// images can arrive as an array or as a JSON string depending on how the row was saved.
function firstImage(images: unknown): string | null {
  if (Array.isArray(images)) {
    const first = images[0]
    return typeof first === 'string' && first ? first : null
  }
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0]
    } catch {
      return images.startsWith('http') ? images : null
    }
  }
  return null
}

export default function ProductCard({
  product,
  showCategory = true,
}: {
  product: ProductCardData
  showCategory?: boolean
}) {
  const src = firstImage(product.images)
  const rated = product.avg_rating != null && product.avg_rating > 0
  const vendor = product.sellers?.store_name ?? null

  return (
    <article className="pc lift">
      {/* The link wraps only the photo and text. The cart button is a sibling, because a button inside a link is invalid HTML. */}
      <Link href={`/products/${product.id}`} className="pc-link">
        <div className="pc-photo">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={product.title} loading="lazy" decoding="async" />
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
          <span className="pc-price"><PriceBlock product={product} /></span>
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
        <CardAddButton
          id={product.id}
          title={product.title}
          price={product.price}
          imageUrl={src}
          vendorName={vendor}
        />
      </div>
    </article>
  )
}