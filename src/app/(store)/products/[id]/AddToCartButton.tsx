"use client"

import { useState } from "react"
import { useCartStore } from "@/store/cart"
import { ShoppingCart, Check, Minus, Plus } from "lucide-react"
import Link from "next/link"
import type { ProductFull } from "@/types"

export default function AddToCartButton({ product }: { product: ProductFull }) {
  const { items, addItem } = useCartStore()
  const [quantity, setQuantity] = useState(1)
  const [justAdded, setJustAdded] = useState(false)

  const cartItem = items.find(i => i.id === product.id)
  const isOutOfStock = product.stock_quantity === 0

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: product.id,
        title: product.title,
        price: product.price,
        quantity: 1,
        image_url: product.images?.[0] ?? null,
        vendor_name: (product.sellers as any)?.store_name ?? null,
      })
    }
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2500)
  }

  return (
    <div className="pd-actions">
      {/* Quantity selector */}
      {!isOutOfStock && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Qty:</span>
          <div className="pd-qty">
            <button
              className="qty-btn"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              <Minus size={14} />
            </button>
            <span className="qty-val">{quantity}</span>
            <button
              className="qty-btn"
              onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))}
              disabled={quantity >= product.stock_quantity}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Buttons row */}
      <div style={{ display: "flex", gap: 10 }}>
        {isOutOfStock ? (
          <button className="btn-cart" disabled style={{ opacity: 0.5, cursor: "not-allowed", flex: 1 }}>
            <ShoppingCart size={18} />
            Out of Stock
          </button>
        ) : justAdded ? (
          <button className="btn-cart" style={{ flex: 1, background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
            <Check size={18} />
            Added to Cart!
          </button>
        ) : (
          <button className="btn-cart" style={{ flex: 1 }} onClick={handleAddToCart}>
            <ShoppingCart size={18} />
            Add to Cart
          </button>
        )}
      </div>

      {/* View cart nudge — shows after adding */}
      {justAdded && (
        <Link href="/cart" style={{
          display: "block", textAlign: "center",
          fontSize: "0.8rem", color: "#2563eb",
          fontWeight: 600, textDecoration: "none",
          marginTop: -4
        }}>
          View cart →
        </Link>
      )}

      {/* Already in cart notice */}
      {cartItem && !justAdded && (
        <div style={{
          fontSize: "0.78rem", color: "#64748b",
          textAlign: "center", marginTop: -4
        }}>
          {cartItem.quantity} already in your cart —{" "}
          <Link href="/cart" style={{ color: "#2563eb", fontWeight: 600 }}>view cart</Link>
        </div>
      )}
    </div>
  )
}