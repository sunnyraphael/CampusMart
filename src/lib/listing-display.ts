// Buyer-side rules for promo prices, condition, low stock and delivery text.
// Pure functions only (no React), so server and client components can share them.

export type ListingFields = {
  price: number
  stock_quantity: number
  compare_at_price?: number | null
  sale_ends_at?: string | null
  condition?: string | null
  availability?: string | null
  delivery_days?: number | null
}

export type Promo = { original: number; percentOff: number; endsAt: Date | null }

// A promo is live when there is an original price above the current price
// and the sale end date (if any) has not passed yet.
export function getPromo(p: ListingFields, now: Date = new Date()): Promo | null {
  const original = p.compare_at_price
  if (!original || original <= p.price) return null
  const endsAt = p.sale_ends_at ? new Date(p.sale_ends_at) : null
  if (endsAt && endsAt.getTime() <= now.getTime()) return null
  const percentOff = Math.min(99, Math.max(1, Math.round((1 - p.price / original) * 100)))
  return { original, percentOff, endsAt }
}

// "Fri 30 Oct" in Lagos time, whatever timezone the viewer's device is in.
export function formatLagosDay(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Lagos',
  }).formatToParts(date)
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')}`
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  used_like_new: 'Used, like new',
  used_good: 'Used, good',
}

export function conditionLabel(condition?: string | null): string | null {
  return condition ? CONDITION_LABELS[condition] ?? null : null
}

export function lowStockLabel(stock: number): string | null {
  return stock > 0 && stock <= 3 ? `Only ${stock} left` : null
}

export type DeliveryInfo = {
  kind: 'on_campus' | 'pre_order'
  short: string // for small product cards
  long: string // for the product page, cart and checkout
}

// Calendar days (Sundays included) counted from now, which stands in for payment time.
// The real promise is frozen onto the order at purchase; this is the preview.
export function getDelivery(p: ListingFields, now: Date = new Date()): DeliveryInfo | null {
  if (p.delivery_days == null) return null
  const days = p.delivery_days
  if (p.availability === 'pre_order') {
    return {
      kind: 'pre_order',
      short: `Pre-order, ${days} days`,
      long: `Pre-order: ready within ${days} days`,
    }
  }
  if (days === 0) {
    return {
      kind: 'on_campus',
      short: 'Same day delivery',
      long: `Same day delivery, expected by ${formatLagosDay(now)}`,
    }
  }
  const when = formatLagosDay(new Date(now.getTime() + days * 86_400_000))
  const unit = days === 1 ? 'day' : 'days'
  return {
    kind: 'on_campus',
    short: `Delivers in ${days} ${unit}`,
    long: `Delivery within ${days} ${unit}, expected by ${when}`,
  }
}