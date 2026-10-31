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
      <style>{css}</style>

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
            <div className="ct-layout" aria-hidden="true">
              <div className="ct-list">
                <div className="ct-skel" />
                <div className="ct-skel" />
              </div>
            </div>
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
const css = `
.ct-page{--ct-brand:#2563eb;--ct-brand-hover:#1d4ed8;background:var(--vx-input);color:var(--vx-text);min-height:100dvh;font-family:'DM Sans',sans-serif}
.ct-wrap{max-width:1100px;margin:0 auto;padding:clamp(16px,4vw,32px) clamp(12px,4vw,24px) 56px}
.ct-head{display:flex;align-items:center;gap:12px;margin-bottom:clamp(14px,3vw,24px)}
.ct-back{display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;border-radius:10px;border:1px solid var(--vx-border);background:var(--vx-card);color:var(--vx-text)}
.ct-back:hover{background:var(--vx-hover)}
.ct-title{font-family:var(--font-sora),sans-serif;font-size:clamp(1.15rem,3.6vw,1.5rem);font-weight:700;line-height:1.2;margin:0;min-width:0}
.ct-count{color:var(--vx-muted);font-size:.875rem;font-weight:500}

.ct-layout{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
@media (min-width:1024px){.ct-layout{grid-template-columns:minmax(0,1fr) 340px;align-items:start}}
.ct-list{display:grid;gap:12px;min-width:0}

.ct-item{display:grid;grid-template-columns:clamp(72px,22vw,112px) minmax(0,1fr);gap:clamp(10px,3vw,16px);background:var(--vx-card);border:1px solid var(--vx-border);border-radius:14px;padding:clamp(10px,3vw,16px)}
.ct-item.is-blocked{border-color:var(--vx-warn-border)}
.ct-img{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:var(--vx-surface)}
.ct-info{display:flex;flex-direction:column;gap:6px;min-width:0}
.ct-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.95rem;font-weight:600;line-height:1.35;color:var(--vx-text);text-decoration:none;overflow-wrap:anywhere}
.ct-name:hover{color:var(--vx-link)}
.ct-vendor{margin:0;font-size:.8rem;color:var(--vx-muted)}
.ct-price{font-family:var(--font-sora),sans-serif;font-size:1.05rem;font-weight:700;color:var(--vx-text);min-width:0}

.ct-note{display:flex;align-items:flex-start;gap:8px;margin:0;padding:8px 10px;border-radius:10px;font-size:.8rem;line-height:1.4;border:1px solid var(--vx-border)}
.ct-note svg{flex:none;margin-top:2px}
.ct-note.is-info{background:var(--vx-surface);color:var(--vx-text-soft)}
.ct-note.is-warn{background:var(--vx-warn-bg);color:var(--vx-warn);border-color:var(--vx-warn-border)}
.ct-linkbtn{background:none;border:0;padding:0;font:inherit;font-weight:600;color:var(--vx-link);text-decoration:underline;cursor:pointer}

.ct-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-top:4px}
.ct-qty{display:inline-flex;align-items:center;border:1px solid var(--vx-border);border-radius:10px;overflow:hidden;background:var(--vx-input)}
.ct-qty button{display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:transparent;border:0;color:var(--vx-text);cursor:pointer}
.ct-qty button:hover:not(:disabled){background:var(--vx-hover)}
.ct-qty button:disabled{opacity:.35;cursor:not-allowed}
.ct-qty output{min-width:36px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums}
.ct-line-total{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums;font-size:.95rem}
.ct-remove{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;border:1px solid var(--vx-err-border);background:transparent;color:var(--vx-err);cursor:pointer}
.ct-remove:hover{background:var(--vx-err-bg)}

.ct-summary{background:var(--vx-card);border:1px solid var(--vx-border);border-radius:14px;padding:clamp(16px,4vw,22px);min-width:0}
@media (min-width:1024px){.ct-summary{position:sticky;top:96px}}
.ct-summary-title{font-family:var(--font-sora),sans-serif;font-size:1rem;font-weight:700;margin:0 0 16px}
.ct-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:10px;font-size:.875rem;color:var(--vx-text-soft)}
.ct-row strong{color:var(--vx-text);font-weight:600;font-variant-numeric:tabular-nums}
.ct-divider{border:0;border-top:1px solid var(--vx-border);margin:14px 0}
.ct-total{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:18px;font-size:1.05rem;font-weight:700}
.ct-total span:last-child{color:var(--vx-link);font-variant-numeric:tabular-nums}
.ct-blocked{display:flex;align-items:center;gap:6px;margin:0 0 12px;font-size:.8rem;color:var(--vx-warn)}

.ct-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-bottom:10px;padding:0 16px;border-radius:10px;border:1px solid transparent;font:600 .95rem 'DM Sans',sans-serif;text-decoration:none;cursor:pointer}
.ct-btn-primary{background:var(--ct-brand);color:#fff}
.ct-btn-primary:hover:not(:disabled){background:var(--ct-brand-hover)}
.ct-btn-primary:disabled{opacity:.5;cursor:not-allowed}
.ct-btn-ghost{background:transparent;color:var(--vx-text);border-color:var(--vx-border)}
.ct-btn-ghost:hover{background:var(--vx-hover)}
.ct-btn-inline{display:inline-flex;width:auto;margin:0}
.ct-fine{margin:4px 0 0;text-align:center;font-size:.75rem;line-height:1.45;color:var(--vx-muted)}

.ct-banner{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin-bottom:16px;padding:12px 14px;border-radius:12px;font-size:.85rem;line-height:1.45;border:1px solid var(--vx-border)}
.ct-banner span{flex:1 1 220px;min-width:0}
.ct-banner.is-warn{background:var(--vx-warn-bg);color:var(--vx-warn);border-color:var(--vx-warn-border)}
.ct-retry{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:8px;border:1px solid var(--vx-warn-border);background:transparent;color:inherit;font:600 .8rem 'DM Sans',sans-serif;cursor:pointer}
.ct-retry:hover{background:var(--vx-warn-bg2)}

.ct-empty{text-align:center;padding:clamp(40px,10vw,64px) 20px;background:var(--vx-card);border:1px solid var(--vx-border);border-radius:14px}
.ct-empty-icon{display:flex;align-items:center;justify-content:center;width:64px;height:64px;margin:0 auto 16px;border-radius:50%;background:var(--vx-surface);color:var(--vx-link)}
.ct-empty h2{font-family:var(--font-sora),sans-serif;font-size:1.1rem;font-weight:700;margin:0 0 8px}
.ct-empty p{max-width:36ch;margin:0 auto 24px;font-size:.9rem;color:var(--vx-muted)}

.ct-skel{height:128px;border-radius:14px;background:var(--vx-surface);animation:ct-pulse 1.4s ease-in-out infinite}
@keyframes ct-pulse{50%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.ct-skel{animation:none}}

.ct-page a:focus-visible,.ct-page button:focus-visible{outline:2px solid var(--vx-link);outline-offset:2px}
`