"use client"

import { useHydrated } from "@/hooks/useHydrated"
import Link from "next/link"
import {
  ArrowLeft,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  TriangleAlert,
  Info,
  RefreshCw,
} from "lucide-react"
import { useCartStore, type CartStoreItem } from "@/store/cart"
import { calcServiceFee } from "@/lib/fees"
import { formatPrice } from "@/lib/utils/format"
import { useLiveListings, type LiveListing } from "@/lib/useLiveListings"
import { PriceBlock, ListingChips, DeliveryLine } from "@/components/store/ListingBits"
import ServiceFeeNote from "@/components/ServiceFeeNote"
import { CartSkeleton } from '@/components/loading/StoreSkeletons'

type LineState = "ok" | "gone" | "soldout" | "short"

export default function CartPage() {
  const { items, removeItem, updateQuantity } = useCartStore()
  const { live, loading, error, retry } = useLiveListings(items.map((i) => i.id))

  // The cart lives in the browser's storage, so the server cannot know what is in it.
  // Waiting until mounted avoids a flash of "Your cart is empty" and hydration errors.
  const mounted = useHydrated()

  const settled = !loading && !error

  const lines = items.map((item) => {
    const l: LiveListing | undefined = live[item.id]
    let state: LineState = "ok"
    if (l) {
      if (l.status !== "active") state = "gone"
      else if (l.stock_quantity <= 0) state = "soldout"
      else if (item.quantity > l.stock_quantity) state = "short"
    } else if (settled) {
      state = "gone" // the database did not return it, so buyers cannot see it any more
    }
    const unitPrice = l ? l.price : item.price
    return { item, live: l, state, unitPrice }
  })

  const counted = lines.filter((x) => x.state === "ok")
  const subtotal = counted.reduce((s, x) => s + x.unitPrice * x.item.quantity, 0)
  const countedQty = counted.reduce((s, x) => s + x.item.quantity, 0)
  const serviceFee = counted.length > 0 ? calcServiceFee(subtotal) : 0
  const total = subtotal + serviceFee
  const blockedCount = lines.length - counted.length
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <>


      <div className="ct-page">
        <div className="ct-wrap">
          <div className="ct-head">
            <Link href="/products" className="ct-back" aria-label="Back to products">
              <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <h1 className="ct-title">
              My cart
              {mounted && items.length > 0 && (
                <span className="ct-count"> ({totalQty} {totalQty === 1 ? "item" : "items"})</span>
              )}
            </h1>
          </div>

          {!mounted ? (
            <CartSkeleton bodyOnly />
          ) : items.length === 0 ? (
            <div className="ct-empty">
              <div className="ct-empty-icon">
                <ShoppingBag size={28} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h2>Your cart is empty</h2>
              <p>You have not added anything yet. Browse listings and add items to get started.</p>
              <Link href="/products" className="ct-btn ct-btn-primary ct-btn-inline">
                Browse listings
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="ct-banner is-warn" role="alert">
                  <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>
                    We could not check the latest prices and stock ({error}). Showing the prices saved
                    when you added each item.
                  </span>
                  <button type="button" className="ct-retry" onClick={retry}>
                    <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" /> Retry
                  </button>
                </div>
              )}

              <div className="ct-layout">
                <div className="ct-list">
                  {lines.map(({ item, live: l, state, unitPrice }) => (
                    <CartLine
                      key={item.id}
                      item={item}
                      live={l}
                      state={state}
                      unitPrice={unitPrice}
                      onRemove={() => removeItem(item.id)}
                      onQty={(q) => updateQuantity(item.id, q)}
                    />
                  ))}
                </div>

                <aside className="ct-summary" aria-label="Order summary">
                  <h2 className="ct-summary-title">Order summary</h2>

                  <div className="ct-row">
                    <span>Subtotal ({countedQty} {countedQty === 1 ? "item" : "items"})</span>
                    <strong>{formatPrice(subtotal)}</strong>
                  </div>
                  <div className="ct-row">
                    <span>Delivery</span>
                    <span>Added at checkout</span>
                  </div>
                  <div className="ct-row">
                    <span>Service fee{serviceFee === 0 && counted.length > 0 ? " (waived)" : " (2%)"}</span>
                    <span>{formatPrice(serviceFee)}</span>
                  </div>
                  <ServiceFeeNote subtotal={subtotal} />

                  <hr className="ct-divider" />

                  <div className="ct-total">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>

                  {blockedCount > 0 && (
                    <p className="ct-blocked" role="status">
                      <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                      Fix {blockedCount} {blockedCount === 1 ? "item" : "items"} above to continue.
                    </p>
                  )}

                  {blockedCount > 0 || counted.length === 0 ? (
                    <button type="button" className="ct-btn ct-btn-primary" disabled>
                      Proceed to checkout
                    </button>
                  ) : (
                    <Link href="/checkout" className="ct-btn ct-btn-primary">
                      Proceed to checkout
                    </Link>
                  )}
                  <Link href="/products" className="ct-btn ct-btn-ghost">
                    Continue shopping
                  </Link>

                  <p className="ct-fine">
                    Prices are in Nigerian naira. The final price is confirmed when you place the order.
                  </p>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function CartLine({
  item,
  live,
  state,
  unitPrice,
  onRemove,
  onQty,
}: {
  item: CartStoreItem
  live: LiveListing | undefined
  state: LineState
  unitPrice: number
  onRemove: () => void
  onQty: (q: number) => void
}) {
  const blocked = state !== "ok"
  const priceChanged = !!live && live.price !== item.price && state !== "gone"
  const atMax = !!live && item.quantity >= live.stock_quantity

  return (
    <article className={`ct-item${blocked ? " is-blocked" : ""}`}>
      {item.image_url ? (
        <img src={item.image_url} alt="" className="ct-img" loading="lazy" />
      ) : (
        <div className="ct-img" />
      )}

      <div className="ct-info">
        <Link href={`/products/${item.id}`} className="ct-name">
          {item.title}
        </Link>
        <p className="ct-vendor">by {item.vendor_name ?? "Vendor"}</p>

        <div className="ct-price">
          <PriceBlock product={live ?? { price: unitPrice, stock_quantity: item.quantity }} />
        </div>

        {live && state !== "gone" && (
          <>
            <ListingChips product={live} showNew={false} lowStock={state === "ok"} />
            <DeliveryLine product={live} />
          </>
        )}

        {priceChanged && (
          <p className="ct-note is-info">
            <Info size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>
              Price changed from {formatPrice(item.price)} to {formatPrice(unitPrice)} since you added it.
            </span>
          </p>
        )}

        {state === "gone" && (
          <p className="ct-note is-warn">
            <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>This listing is no longer available. Remove it to continue.</span>
          </p>
        )}
        {state === "soldout" && (
          <p className="ct-note is-warn">
            <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Out of stock. Remove it to continue.</span>
          </p>
        )}
        {state === "short" && live && (
          <p className="ct-note is-warn">
            <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>
              Only {live.stock_quantity} left.{" "}
              <button type="button" className="ct-linkbtn" onClick={() => onQty(live.stock_quantity)}>
                Set quantity to {live.stock_quantity}
              </button>
            </span>
          </p>
        )}

        <div className="ct-actions">
          {state === "gone" || state === "soldout" ? (
            <span />
          ) : (
            <div className="ct-qty" role="group" aria-label={`Quantity for ${item.title}`}>
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => (item.quantity > 1 ? onQty(item.quantity - 1) : onRemove())}
              >
                <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <output aria-live="polite">{item.quantity}</output>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={atMax}
                onClick={() => onQty(item.quantity + 1)}
              >
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          )}

          {!blocked && <span className="ct-line-total">{formatPrice(unitPrice * item.quantity)}</span>}

          <button type="button" className="ct-remove" aria-label={`Remove ${item.title}`} onClick={onRemove}>
            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}

// All colours come from the --vx-* tokens in globals.css, so light and dark follow the toggle.
// Sizes use clamp(), minmax() and aspect-ratio so the page fits every phone width.
