import { Clock, Truck } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import {
  type ListingFields,
  conditionLabel,
  formatLagosDay,
  getDelivery,
  getPromo,
  lowStockLabel,
} from '@/lib/listing-display'

// Presentational pieces shared by the product cards, product page, storefront,
// cart, checkout and orders. No hooks, so they work in server and client components.
// Styles live in globals.css under "Listing display" and use the --vx-* tokens.

export function PriceBlock({
  product,
  showSaleEnd = false,
  badge = false,
}: {
  product: ListingFields
  showSaleEnd?: boolean
  badge?: boolean
}) {
  const promo = getPromo(product)
  return (
    <span className="ld-price">
      <span className="ld-top">
        <span className="ld-now">{formatPrice(product.price)}</span>
        {badge && promo && <span className="ld-badge">{promo.percentOff}% off</span>}
      </span>
      {promo && (
        <span className="ld-was-row">
          <del className="ld-was">
            <span className="sr-only">Original price </span>
            {formatPrice(promo.original)}
          </del>
          {showSaleEnd && promo.endsAt && (
            <span className="ld-end">Sale ends {formatLagosDay(promo.endsAt)}</span>
          )}
        </span>
      )}
    </span>
  )
}

// Solid red pill that sits on the corner of a product photo.
export function PromoCorner({ product }: { product: ListingFields }) {
  const promo = getPromo(product)
  if (!promo) return null
  return <span className="ld-corner">{promo.percentOff}% off</span>
}

export function ListingChips({
  product,
  showNew = false,
  lowStock = true,
}: {
  product: ListingFields
  showNew?: boolean
  lowStock?: boolean
}) {
  const condition = product.condition
  const cond = condition && (showNew || condition !== 'new') ? conditionLabel(condition) : null
  const low = lowStock ? lowStockLabel(product.stock_quantity) : null
  if (!cond && !low) return null
  return (
    <span className="ld-chips">
      {cond && <span className="ld-chip">{cond}</span>}
      {low && <span className="ld-chip is-low">{low}</span>}
    </span>
  )
}

export function DeliveryLine({
  product,
  variant = 'short',
}: {
  product: ListingFields
  variant?: 'short' | 'long'
}) {
  const info = getDelivery(product)
  if (!info) return null
  const Icon = info.kind === 'pre_order' ? Clock : Truck
  return (
    <span className={`ld-delivery${variant === 'long' ? ' is-long' : ''}`}>
      <Icon size={variant === 'long' ? 16 : 12} strokeWidth={1.75} aria-hidden="true" />
      <span>{variant === 'long' ? info.long : info.short}</span>
    </span>
  )
}