"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/store/cart"
import { ArrowLeft, MapPin, Package, CreditCard, CheckCircle2, Loader2 } from "lucide-react"

type DeliveryMethod = "pickup" | "delivery"
type CheckoutStep = "details" | "payment" | "success"

export default function CheckoutPage() {
  const router = useRouter()
  const { items, clearCart } = useCartStore()

  const [step, setStep] = useState<CheckoutStep>("details")
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup")
  const [form, setForm] = useState({ address: "", phone: "", note: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryFee = deliveryMethod === "delivery" ? 500 : 0
  const serviceFee = Math.round(subtotal * 0.02)
  const total = subtotal + deliveryFee + serviceFee

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount)

  const handleProceedToPayment = () => {
    if (deliveryMethod === "delivery") {
      if (!form.address.trim()) { setError("Please enter your delivery address."); return }
      if (!form.phone.trim()) { setError("Please enter your phone number."); return }
    }
    setError("")
    setStep("payment")
  }

  const handlePayWithPaystack = async () => {
    setLoading(true)
    // Paystack inline payment — will be wired up when Paystack keys are added
    // For now, simulates a successful payment after 2 seconds
    setTimeout(() => {
      setLoading(false)
      clearCart()
      setStep("success")
    }, 2000)
  }

  // Redirect if cart is empty and not on success screen
  if (items.length === 0 && step !== "success") {
    return (
      <>
        <style>{`
          .empty-checkout { min-height: 100vh; background: #f5f7ff; display: flex; align-items: center; justify-content: center; padding: 24px; }
          .dark .empty-checkout { background: #060d1f; }
          .empty-checkout-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 40px 28px; text-align: center; max-width: 360px; width: 100%; }
          .dark .empty-checkout-card { background: #0f1a35; border-color: #1e3a5f; }
          .empty-checkout-card h2 { font-family: var(--font-sora), sans-serif; font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
          .dark .empty-checkout-card h2 { color: #f1f5f9; }
          .empty-checkout-card p { font-size: 0.875rem; color: #64748b; margin-bottom: 24px; }
          .dark .empty-checkout-card p { color: #94a3b8; }
          .empty-checkout-btn { display: inline-block; padding: 11px 24px; background: #2563eb; color: white; border-radius: 10px; font-weight: 600; font-size: 0.875rem; text-decoration: none; }
        `}</style>
        <div className="empty-checkout">
          <div className="empty-checkout-card">
            <h2>Your cart is empty</h2>
            <p>Add some items before checking out.</p>
            <Link href="/products" className="empty-checkout-btn">Browse Products</Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        .checkout-page { background: #f5f7ff; min-height: 100vh; }
        .dark .checkout-page { background: #060d1f; }

        /* Mobile header */
        .checkout-mobile-header {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px;
          background: #2563eb; color: white;
          position: sticky; top: 0; z-index: 40;
        }
        @media (min-width: 768px) { .checkout-mobile-header { display: none; } }

        .checkout-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 24px 16px;
        }
        @media (min-width: 768px) { .checkout-container { padding: 32px 24px; } }

        .checkout-desktop-title {
          display: none;
          font-family: var(--font-sora), sans-serif;
          font-size: 1.5rem; font-weight: 700;
          color: #0f172a; margin-bottom: 24px;
        }
        .dark .checkout-desktop-title { color: #f1f5f9; }
        @media (min-width: 768px) { .checkout-desktop-title { display: block; } }

        /* Progress steps */
        .checkout-steps {
          display: flex; align-items: center;
          gap: 0; margin-bottom: 28px;
        }
        .checkout-step {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.8rem; font-weight: 600;
        }
        .step-circle {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 700;
          flex-shrink: 0;
        }
        .step-circle.active { background: #2563eb; color: white; }
        .step-circle.done { background: #22c55e; color: white; }
        .step-circle.inactive { background: #e2e8f0; color: #94a3b8; }
        .dark .step-circle.inactive { background: #1e3a5f; color: #475569; }
        .step-label.active { color: #2563eb; }
        .step-label.done { color: #22c55e; }
        .step-label.inactive { color: #94a3b8; }
        .step-line { flex: 1; height: 2px; background: #e2e8f0; margin: 0 8px; }
        .dark .step-line { background: #1e3a5f; }
        .step-line.done { background: #22c55e; }

        /* Layout */
        .checkout-layout {
          display: flex; flex-direction: column; gap: 20px;
        }
        @media (min-width: 1024px) {
          .checkout-layout { flex-direction: row; align-items: flex-start; }
        }

        /* Panel */
        .checkout-panel {
          flex: 1;
          background: white; border-radius: 16px;
          border: 1px solid #e2e8f0; padding: 24px;
        }
        .dark .checkout-panel { background: #0f1a35; border-color: #1e3a5f; }

        .panel-title {
          font-family: var(--font-sora), sans-serif;
          font-size: 1rem; font-weight: 700;
          color: #0f172a; margin-bottom: 20px;
          display: flex; align-items: center; gap: 8px;
        }
        .dark .panel-title { color: #f1f5f9; }

        /* Delivery toggle */
        .delivery-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .delivery-option {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 16px; border-radius: 12px;
          border: 2px solid #e2e8f0;
          cursor: pointer; transition: all 0.2s;
          background: white;
        }
        .dark .delivery-option { background: #0a1628; border-color: #1e3a5f; }
        .delivery-option:hover { border-color: #2563eb; }
        .delivery-option.selected { border-color: #2563eb; background: #eff6ff; }
        .dark .delivery-option.selected { background: #172554; border-color: #3b82f6; }
        .delivery-radio {
          width: 20px; height: 20px; border-radius: 50%;
          border: 2px solid #e2e8f0;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px; transition: all 0.2s;
        }
        .delivery-option.selected .delivery-radio { border-color: #2563eb; }
        .delivery-radio-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #2563eb;
        }
        .delivery-option-title {
          font-size: 0.875rem; font-weight: 700;
          color: #0f172a; margin-bottom: 2px;
        }
        .dark .delivery-option-title { color: #f1f5f9; }
        .delivery-option-desc { font-size: 0.78rem; color: #64748b; }
        .dark .delivery-option-desc { color: #94a3b8; }
        .delivery-option-fee {
          margin-left: auto; font-size: 0.8rem; font-weight: 700;
          color: #2563eb; flex-shrink: 0;
        }

        /* Form fields */
        .checkout-field { margin-bottom: 16px; }
        .checkout-label { font-size: 0.78rem; font-weight: 600; color: #374151; margin-bottom: 6px; display: block; }
        .dark .checkout-label { color: #94a3b8; }
        .checkout-input {
          width: 100%; padding: 11px 14px;
          border-radius: 10px; border: 1.5px solid #e2e8f0;
          font-size: 0.875rem; outline: none;
          background: white; color: #0f172a;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .dark .checkout-input { background: #0a1628; border-color: #1e3a5f; color: #f1f5f9; }
        .checkout-input:focus { border-color: #2563eb; }
        textarea.checkout-input { resize: vertical; min-height: 80px; }

        .checkout-error { font-size: 0.78rem; color: #ef4444; margin-bottom: 12px; }

        /* Order items */
        .order-item {
          display: flex; gap: 12px; align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .dark .order-item { border-color: #1e3a5f; }
        .order-item:last-child { border-bottom: none; }
        .order-item-img {
          width: 52px; height: 52px; border-radius: 8px;
          object-fit: cover; background: #e2e8f0; flex-shrink: 0;
        }
        .dark .order-item-img { background: #1e3a5f; }
        .order-item-title { font-size: 0.825rem; font-weight: 600; color: #0f172a; margin-bottom: 2px; }
        .dark .order-item-title { color: #f1f5f9; }
        .order-item-qty { font-size: 0.75rem; color: #64748b; }
        .dark .order-item-qty { color: #94a3b8; }
        .order-item-price { margin-left: auto; font-size: 0.875rem; font-weight: 700; color: #2563eb; flex-shrink: 0; }

        /* Summary panel */
        .summary-panel {
          background: white; border-radius: 16px;
          border: 1px solid #e2e8f0; padding: 24px;
        }
        .dark .summary-panel { background: #0f1a35; border-color: #1e3a5f; }
        @media (min-width: 1024px) { .summary-panel { width: 300px; flex-shrink: 0; position: sticky; top: 90px; } }

        .summary-row {
          display: flex; justify-content: space-between;
          font-size: 0.875rem; color: #475569; margin-bottom: 10px;
        }
        .dark .summary-row { color: #94a3b8; }
        .summary-divider { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
        .dark .summary-divider { border-color: #1e3a5f; }
        .summary-total { display: flex; justify-content: space-between; font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: 20px; }
        .dark .summary-total { color: #f1f5f9; }

        /* Buttons */
        .checkout-btn {
          width: 100%; padding: 13px;
          border-radius: 12px; border: none;
          background: #2563eb; color: white;
          font-size: 0.9rem; font-weight: 600;
          cursor: pointer; transition: background 0.2s;
          font-family: var(--font-sora), sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .checkout-btn:hover:not(:disabled) { background: #1d4ed8; }
        .checkout-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .checkout-btn-outline {
          width: 100%; padding: 11px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: transparent; color: #475569;
          font-size: 0.875rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
          margin-top: 10px;
        }
        .dark .checkout-btn-outline { border-color: #1e3a5f; color: #94a3b8; }
        .checkout-btn-outline:hover { border-color: #2563eb; color: #2563eb; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.7s linear infinite; }

        /* Payment box */
        .payment-box {
          border: 2px dashed #e2e8f0; border-radius: 12px;
          padding: 24px; text-align: center; margin-bottom: 20px;
        }
        .dark .payment-box { border-color: #1e3a5f; }
        .payment-box-title { font-size: 0.9rem; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
        .dark .payment-box-title { color: #f1f5f9; }
        .payment-box-sub { font-size: 0.8rem; color: #64748b; }
        .dark .payment-box-sub { color: #94a3b8; }
        .payment-total-big { font-size: 1.75rem; font-weight: 800; color: #2563eb; margin: 12px 0; font-family: var(--font-sora), sans-serif; }

        /* Success */
        .success-screen { text-align: center; padding: 20px 0; }
        .success-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: #f0fdf4;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
        }
        .dark .success-icon { background: #14532d; }
        .success-title { font-family: var(--font-sora), sans-serif; font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
        .dark .success-title { color: #f1f5f9; }
        .success-sub { font-size: 0.875rem; color: #64748b; line-height: 1.6; margin-bottom: 28px; }
        .dark .success-sub { color: #94a3b8; }
      `}</style>

      <div className="checkout-page">
        {/* Mobile header */}
        <div className="checkout-mobile-header">
          {step === "details" ? (
            <Link href="/cart"><ArrowLeft size={20} color="white" /></Link>
          ) : (
            <button
              onClick={() => setStep(step === "payment" ? "details" : "payment")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <ArrowLeft size={20} color="white" />
            </button>
          )}
          <span style={{ fontFamily: "var(--font-sora)", fontWeight: 700, fontSize: "1rem" }}>
            Checkout
          </span>
        </div>

        <div className="checkout-container">
          <div className="checkout-desktop-title">Checkout</div>

          {/* Progress indicator */}
          {step !== "success" && (
            <div className="checkout-steps">
              <div className="checkout-step">
                <div className={`step-circle ${step === "details" ? "active" : "done"}`}>
                  {step === "details" ? "1" : "✓"}
                </div>
                <span className={`step-label ${step === "details" ? "active" : "done"}`}>Details</span>
              </div>
              <div className={`step-line ${step === "payment" ? "done" : ""}`} />
              <div className="checkout-step">
                <div className={`step-circle ${step === "payment" ? "active" : "inactive"}`}>2</div>
                <span className={`step-label ${step === "payment" ? "active" : "inactive"}`}>Payment</span>
              </div>
            </div>
          )}

          {/* ── STEP 1: Delivery details ── */}
          {step === "details" && (
            <div className="checkout-layout">
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Delivery method */}
                <div className="checkout-panel">
                  <div className="panel-title">
                    <Package size={18} color="#2563eb" />
                    Delivery Method
                  </div>
                  <div className="delivery-options">
                    <div
                      className={`delivery-option ${deliveryMethod === "pickup" ? "selected" : ""}`}
                      onClick={() => setDeliveryMethod("pickup")}
                    >
                      <div className="delivery-radio">
                        {deliveryMethod === "pickup" && <div className="delivery-radio-dot" />}
                      </div>
                      <div>
                        <div className="delivery-option-title">Campus Pickup</div>
                        <div className="delivery-option-desc">Meet the seller on campus to collect your item</div>
                      </div>
                      <div className="delivery-option-fee">Free</div>
                    </div>
                    <div
                      className={`delivery-option ${deliveryMethod === "delivery" ? "selected" : ""}`}
                      onClick={() => setDeliveryMethod("delivery")}
                    >
                      <div className="delivery-radio">
                        {deliveryMethod === "delivery" && <div className="delivery-radio-dot" />}
                      </div>
                      <div>
                        <div className="delivery-option-title">Seller Delivers</div>
                        <div className="delivery-option-desc">Seller brings the item to your location</div>
                      </div>
                      <div className="delivery-option-fee">+₦500</div>
                    </div>
                  </div>

                  {/* Delivery fields — only shown when delivery is selected */}
                  {deliveryMethod === "delivery" && (
                    <>
                      <div className="checkout-field">
                        <label className="checkout-label">Delivery Address</label>
                        <input
                          className="checkout-input"
                          type="text"
                          placeholder="e.g. Block C, Room 14, Hostel 3"
                          value={form.address}
                          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                        />
                      </div>
                      <div className="checkout-field">
                        <label className="checkout-label">Phone Number</label>
                        <input
                          className="checkout-input"
                          type="tel"
                          placeholder="e.g. 08012345678"
                          value={form.phone}
                          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        />
                      </div>
                    </>
                  )}

                  <div className="checkout-field" style={{ marginBottom: 0 }}>
                    <label className="checkout-label">Order Note (optional)</label>
                    <textarea
                      className="checkout-input"
                      placeholder="Any special instructions for the seller..."
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Order items */}
                <div className="checkout-panel">
                  <div className="panel-title">
                    <Package size={18} color="#2563eb" />
                    Order Items ({items.reduce((s, i) => s + i.quantity, 0)})
                  </div>
                  {items.map(item => (
                    <div key={item.id} className="order-item">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.title} className="order-item-img" />
                        : <div className="order-item-img" />
                      }
                      <div>
                        <div className="order-item-title">{item.title}</div>
                        <div className="order-item-qty">Qty: {item.quantity}</div>
                      </div>
                      <div className="order-item-price">{formatPrice(item.price * item.quantity)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="summary-panel">
                <div className="panel-title" style={{ marginBottom: 16 }}>Order Summary</div>
                <div className="summary-row"><span>Subtotal</span><span style={{ color: "#0f172a", fontWeight: 600 }}>{formatPrice(subtotal)}</span></div>
                <div className="summary-row"><span>Delivery fee</span><span>{formatPrice(deliveryFee)}</span></div>
                <div className="summary-row"><span>Service fee (2%)</span><span>{formatPrice(serviceFee)}</span></div>
                <hr className="summary-divider" />
                <div className="summary-total"><span>Total</span><span style={{ color: "#2563eb" }}>{formatPrice(total)}</span></div>

                {error && <div className="checkout-error">{error}</div>}

                <button className="checkout-btn" onClick={handleProceedToPayment}>
                  <CreditCard size={16} />
                  Proceed to Payment
                </button>
                <Link href="/cart">
                  <button className="checkout-btn-outline">Back to Cart</button>
                </Link>
              </div>
            </div>
          )}

          {/* ── STEP 2: Payment ── */}
          {step === "payment" && (
            <div className="checkout-layout">
              <div className="checkout-panel" style={{ flex: 1 }}>
                <div className="panel-title">
                  <CreditCard size={18} color="#2563eb" />
                  Complete Payment
                </div>

                <div className="payment-box">
                  <div className="payment-box-title">Amount to Pay</div>
                  <div className="payment-total-big">{formatPrice(total)}</div>
                  <div className="payment-box-sub">
                    {deliveryMethod === "delivery"
                      ? `Includes ₦500 delivery fee to ${form.address || "your address"}`
                      : "Campus pickup — no delivery fee"}
                  </div>
                </div>

                <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 20, lineHeight: 1.6 }}>
                  You'll be redirected to Paystack to complete your payment securely. Your order will be confirmed once payment is successful.
                </div>

                <button className="checkout-btn" disabled={loading} onClick={handlePayWithPaystack}>
                  {loading ? (
                    <><Loader2 size={16} className="spin" /> Processing...</>
                  ) : (
                    <>Pay {formatPrice(total)} with Paystack</>
                  )}
                </button>
                <button className="checkout-btn-outline" onClick={() => setStep("details")}>
                  Back to Details
                </button>
              </div>

              {/* Summary */}
              <div className="summary-panel">
                <div className="panel-title" style={{ marginBottom: 16 }}>Order Summary</div>
                <div className="summary-row"><span>Subtotal</span><span style={{ color: "#0f172a", fontWeight: 600 }}>{formatPrice(subtotal)}</span></div>
                <div className="summary-row"><span>Delivery fee</span><span>{formatPrice(deliveryFee)}</span></div>
                <div className="summary-row"><span>Service fee (2%)</span><span>{formatPrice(serviceFee)}</span></div>
                <hr className="summary-divider" />
                <div className="summary-total"><span>Total</span><span style={{ color: "#2563eb" }}>{formatPrice(total)}</span></div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>
                  🔒 Payments are secured by Paystack. CampusMart does not store your card details.
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Success ── */}
          {step === "success" && (
            <div className="checkout-panel" style={{ maxWidth: 480, margin: "0 auto" }}>
              <div className="success-screen">
                <div className="success-icon">
                  <CheckCircle2 size={36} color="#22c55e" />
                </div>
                <div className="success-title">Order Placed!</div>
                <div className="success-sub">
                  Your payment was successful and your order has been confirmed.
                  {deliveryMethod === "delivery"
                    ? " The seller will contact you to arrange delivery."
                    : " The seller will contact you to arrange a pickup time."}
                </div>
                <Link href="/orders">
                  <button className="checkout-btn" style={{ marginBottom: 10 }}>View My Orders</button>
                </Link>
                <Link href="/products">
                  <button className="checkout-btn-outline">Continue Shopping</button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}