"use client"

import { useCartStore } from "@/store/cart"
import { ShoppingCart, Check, Minus, Plus } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import type { ProductFull } from "@/types"

export default function AddToCartButton({ product }: { product: ProductFull }) {
  const { items, addItem, updateQuantity } = useCartStore()
  const [quantity, setQuantity] = useState(1)

  const cartItem = items.find(i => i.id === product.id)
  const isOutOfStock = product.stock_quantity === 0
  const isInCart = !!cartItem

  const stockQty = product.stock_quantity ?? Infinity
  const maxAddable = isInCart ? Math.max(0, stockQty - cartItem.quantity) : stockQty

  useEffect(() => {
    if (quantity > maxAddable) {
      // If available addable amount drops (or user navigates), clamp quantity
      setQuantity(maxAddable > 0 ? Math.min(maxAddable, quantity) : 0)
    }
    if (maxAddable === 0 && quantity !== 0) setQuantity(0)
  }, [maxAddable])

  const handleAddToCart = () => {
    if (isOutOfStock) return

    if (isInCart) {
      if (quantity <= 0) return
      // bump its quantity by the selected amount, but ensure we don't exceed stock
      const newQty = Math.min(cartItem.quantity + quantity, stockQty as number)
      updateQuantity(product.id, newQty)
    } else {
      if (quantity <= 0) return
      addItem({
        id: product.id,
        title: product.title,
        price: product.price,
        quantity,
        image_url: product.images?.[0] ?? null,
        vendor_name: (product.sellers as any)?.store_name ?? null,
      })
    }
  }

  return (
    <div className="pd-actions">
      {/* Quantity selector */}
      {/* Show quantity selector for in-cart items too (but cap by remaining stock) */}
      {!isOutOfStock && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Qty:</span>
          <div className="pd-qty">
            <button
              className="qty-btn"
              onClick={() => {
                const minQty = maxAddable === 0 ? 0 : 1
                setQuantity(q => Math.max(minQty, q - 1))
              }}
              disabled={quantity <= (maxAddable === 0 ? 0 : 1)}
              aria-label="Decrease quantity"
            >
              <Minus size={14} />
            </button>
            <span className="qty-val">{quantity}</span>
            <button
              className="qty-btn"
              onClick={() => setQuantity(q => Math.min(maxAddable, q + 1))}
              disabled={quantity >= maxAddable}
              aria-label="Increase quantity"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main button */}
      <div style={{ display: "flex", gap: 10 }}>
        {isOutOfStock ? (
          <button className="btn-cart" disabled style={{ opacity: 0.5, cursor: "not-allowed", flex: 1 }}>
            <ShoppingCart size={18} />
            Out of Stock
          </button>
        ) : isInCart ? (
          <button
            className="btn-cart"
            style={{ flex: 1, background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            onClick={handleAddToCart}
            disabled={maxAddable <= 0}
          >
            <Check size={18} />
            {maxAddable <= 0 ? "Max in cart" : `Add ${quantity} More`}
          </button>
        ) : (
          <button className="btn-cart" style={{ flex: 1 }} onClick={handleAddToCart}>
            <ShoppingCart size={18} />
            Add to Cart
          </button>
        )}
      </div>

      {/* Cart status */}
      {isInCart && (
        <div style={{
          fontSize: "0.78rem", color: "#16a34a",
          textAlign: "center", marginTop: -4, fontWeight: 600
        }}>
          ✓ {cartItem.quantity} in your cart —{" "}
          <Link href="/cart" style={{ color: "#2563eb" }}>view cart</Link>
        </div>
      )}
    </div>
  )
}