"use client";

import { useCartStore } from "@/store/cart";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const { items, removeItem, updateQuantity } = useCartStore();

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const deliveryFee = items.length > 0 ? 500 : 0;
  const serviceFee = items.length > 0 ? Math.round(subtotal * 0.02) : 0;
  const total = subtotal + deliveryFee + serviceFee;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);

  return (
    <>
      <style>{`
        .cart-page { background: #f5f7ff; min-height: 100vh; }
        .dark .cart-page { background: #060d1f; }

        /* Mobile header strip */
        .cart-mobile-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: #2563eb;
          color: white;
          position: sticky;
          top: 0;
          z-index: 40;
        }
        @media (min-width: 768px) {
          .cart-mobile-header { display: none; }
        }

        .cart-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 16px;
        }
        @media (min-width: 768px) {
          .cart-container { padding: 32px 24px; }
        }

        .cart-desktop-title {
          display: none;
          font-family: var(--font-sora), sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 24px;
        }
        .dark .cart-desktop-title { color: #f1f5f9; }
        @media (min-width: 768px) { .cart-desktop-title { display: block; } }

        .cart-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        @media (min-width: 1024px) {
          .cart-layout {
            flex-direction: row;
            align-items: flex-start;
          }
        }

        /* Items list */
        .cart-items-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cart-item-card {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 14px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .dark .cart-item-card {
          background: #0f1a35;
          border-color: #1e3a5f;
        }

        .cart-item-image {
          width: 80px;
          height: 80px;
          border-radius: 8px;
          object-fit: cover;
          background: #e2e8f0;
          flex-shrink: 0;
        }
        .dark .cart-item-image { background: #1e3a5f; }

        .cart-item-info { flex: 1; min-width: 0; }

        .cart-item-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dark .cart-item-title { color: #f1f5f9; }

        .cart-item-vendor {
          font-size: 0.78rem;
          color: #64748b;
          margin-bottom: 10px;
        }
        .dark .cart-item-vendor { color: #94a3b8; }

        .cart-item-price {
          font-size: 1rem;
          font-weight: 700;
          color: #2563eb;
        }

        .cart-item-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
        }

        .qty-controls {
          display: flex;
          align-items: center;
          gap: 0;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        .dark .qty-controls { border-color: #1e3a5f; }

        .qty-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          border: none;
          cursor: pointer;
          color: #475569;
          transition: background 0.15s;
        }
        .dark .qty-btn { background: #1e3a5f; color: #94a3b8; }
        .qty-btn:hover { background: #e2e8f0; }
        .dark .qty-btn:hover { background: #2a4a7f; }

        .qty-value {
          width: 36px;
          text-align: center;
          font-size: 0.85rem;
          font-weight: 600;
          color: #0f172a;
          background: white;
          border-left: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          line-height: 32px;
        }
        .dark .qty-value {
          background: #0f1a35;
          color: #f1f5f9;
          border-color: #1e3a5f;
        }

        .remove-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid #fecaca;
          background: transparent;
          color: #ef4444;
          cursor: pointer;
          transition: background 0.15s;
        }
        .remove-btn:hover { background: #fef2f2; }
        .dark .remove-btn { border-color: #7f1d1d; }
        .dark .remove-btn:hover { background: #1a0a0a; }

        /* Summary panel */
        .summary-panel {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 20px;
        }
        .dark .summary-panel {
          background: #0f1a35;
          border-color: #1e3a5f;
        }
        @media (min-width: 1024px) {
          .summary-panel { width: 320px; flex-shrink: 0; position: sticky; top: 90px; }
        }

        .summary-title {
          font-family: var(--font-sora), sans-serif;
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 16px;
        }
        .dark .summary-title { color: #f1f5f9; }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
          color: #475569;
          margin-bottom: 10px;
        }
        .dark .summary-row { color: #94a3b8; }

        .summary-divider {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 14px 0;
        }
        .dark .summary-divider { border-color: #1e3a5f; }

        .summary-total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 20px;
        }
        .dark .summary-total-row { color: #f1f5f9; }

        /* Empty state */
        .empty-cart {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .dark .empty-cart {
          background: #0f1a35;
          border-color: #1e3a5f;
        }
        .empty-cart-icon {
          width: 64px;
          height: 64px;
          background: #eff6ff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          color: #2563eb;
        }
        .dark .empty-cart-icon { background: #1e3a5f; }
        .empty-cart h3 {
          font-family: var(--font-sora), sans-serif;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .dark .empty-cart h3 { color: #f1f5f9; }
        .empty-cart p {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 24px;
        }
        .dark .empty-cart p { color: #94a3b8; }
      `}</style>

      <div className="cart-page">
        {/* Mobile header */}
        <div className="cart-mobile-header">
          <Link href="/products">
            <ArrowLeft size={20} />
          </Link>
          <span style={{ fontFamily: "var(--font-sora)", fontWeight: 700, fontSize: "1rem" }}>
            My Cart ({items.length})
          </span>
        </div>

        <div className="cart-container">
          <h1 className="cart-desktop-title">My Cart ({items.length} items)</h1>

          {items.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-cart-icon">
                <ShoppingBag size={28} />
              </div>
              <h3>Your cart is empty</h3>
              <p>You haven't added anything yet. Browse listings and add items to get started.</p>
              <Link href="/products">
                <Button style={{ background: "#2563eb", color: "white", borderRadius: "8px" }}>
                  Browse Products
                </Button>
              </Link>
            </div>
          ) : (
            <div className="cart-layout">
              {/* Items */}
              <div className="cart-items-panel">
                {items.map((item) => (
                  <div key={item.id} className="cart-item-card">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="cart-item-image"
                      />
                    ) : (
                      <div className="cart-item-image" />
                    )}
                    <div className="cart-item-info">
                      <p className="cart-item-title">{item.title}</p>
                      <p className="cart-item-vendor">by {item.vendor_name ?? "Vendor"}</p>
                      <p className="cart-item-price">{formatPrice(item.price)}</p>
                      <div className="cart-item-actions">
                        <div className="qty-controls">
                          <button
                            className="qty-btn"
                            onClick={() =>
                              item.quantity > 1
                                ? updateQuantity(item.id, item.quantity - 1)
                                : removeItem(item.id)
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <span className="qty-value">{item.quantity}</span>
                          <button
                            className="qty-btn"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button className="remove-btn" onClick={() => removeItem(item.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="summary-panel">
                <h2 className="summary-title">Order Summary</h2>

                <div className="summary-row">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <span style={{ color: "#0f172a", fontWeight: 600 }} className="dark:text-white">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                <div className="summary-row">
                  <span>Delivery fee</span>
                  <span>{formatPrice(deliveryFee)}</span>
                </div>
                <div className="summary-row">
                  <span>Service fee (2%)</span>
                  <span>{formatPrice(serviceFee)}</span>
                </div>

                <hr className="summary-divider" />

                <div className="summary-total-row">
                  <span>Total</span>
                  <span style={{ color: "#2563eb" }}>{formatPrice(total)}</span>
                </div>

                <Link href="/checkout">
                  <Button
                    style={{
                      width: "100%",
                      background: "#2563eb",
                      color: "white",
                      borderRadius: "8px",
                      fontWeight: 600,
                      marginBottom: "10px",
                      padding: "12px",
                      fontSize: "0.95rem",
                    }}
                  >
                    Proceed to Checkout
                  </Button>
                </Link>

                <Link href="/products">
                  <Button
                    variant="outline"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      fontWeight: 500,
                    }}
                  >
                    Continue Shopping
                  </Button>
                </Link>

                <p style={{ fontSize: "0.72rem", color: "#94a3b8", textAlign: "center", marginTop: "12px" }}>
                  Prices shown in Nigerian Naira (₦). Delivery fees may vary.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}