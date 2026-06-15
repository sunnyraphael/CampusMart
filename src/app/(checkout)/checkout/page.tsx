"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/store/cart"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, MapPin, Package, CreditCard, CheckCircle2, Loader2 } from "lucide-react"

type DeliveryMethod = "pickup" | "delivery"
type CheckoutStep = "details" | "payment" | "success"

export default function CheckoutPage() {
  const router = useRouter()
  const { items, clearCart } = useCartStore()
  const supabase = createClient()

  const [step, setStep] = useState<CheckoutStep>("details")
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup")
  const [form, setForm] = useState({ address: "", phone: "", note: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [orderId, setOrderId] = useState<string | null>(null)

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
    setError("")

    try {
      // 1. Get the logged-in user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("You must be logged in to place an order.")
        setLoading(false)
        return
      }

      // 2. Create the order record in Supabase
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          buyer_id: user.id,
          total_amount: total,
          delivery_fee: deliveryFee,
          service_fee: serviceFee,
          delivery_method: deliveryMethod,
          delivery_address: deliveryMethod === "delivery" ? form.address : null,
          phone_number: deliveryMethod === "delivery" ? form.phone : null,
          note: form.note || null,
          status: "pending",
          payment_status: "paid", // simulated — will be set by Paystack webhook later
        })
        .select()
        .single()

      if (orderError || !order) {
        console.error("Order error:", orderError)
        setError("Failed to create order. Please try again.")
        setLoading(false)
        return
      }

      // 3. Create one order_item row per cart item
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }))

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems)

      if (itemsError) {
        console.error("Order items error:", itemsError)
        setError("Order created but items failed to save. Contact support.")
        setLoading(false)
        return
      }

      // 4. All good — clear cart and show success
      setOrderId(order.id)
      clearCart()
      setStep("success")

    } catch (err) {
      console.error("Unexpected error:", err)
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
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

        .checkout-mobile-header {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px;
          background: #2563eb; color: white;
          position: sticky; top: 113px; z-index: 30;
        }
        @media (min-width: 768px) { .checkout-mobile-header { display: none; } }

        .checkout-container { max-width: 1000px; margin: 0 auto; padding: 24px 16px; }
        @media (min-width: 768px) { .checkout-container { padding: 32px 24px; } }

        .checkout-desktop-title {
          display: none;
          font-family: var(--font-sora), sans-serif;
          font-size: 1.5rem; font-weight: 700;
          color: #0f172a; margin-bottom: 24px;
        }
        .dark .checkout-desktop-title { color: #f1f5f9; }
        @media (min-width: 768px) { .checkout-desktop-title { display: block; } }

        .checkout-steps { display: flex; align-items: center; gap: 0; margin-bottom: 28px; }
        .checkout-step { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; }
        .step-circle { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
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

        .checkout-layout { display: flex; flex-direction: column; gap: 20px; }
        @media (min-width: 1024px) { .checkout-layout { flex-direction: row; align-items: flex-start; } }

        .checkout-panel { flex: 1; background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; }
        .dark .checkout-panel { background: #0f1a35; border-color: #1e3a5f; }

        .panel-title { font-family: var(--font-sora), sans-serif; font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
        .dark .panel-title { color: #f1f5f9; }

        .delivery-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .delivery-option { display: flex; align-items: flex-start; gap: 14px; padding: 16px; border-radius: 12px; border: 2px solid #e2e8f0; cursor: pointer; transition: all 0.2s; background: white; }
        .dark .delivery-option { background: #0a1628; border-color: #1e3a5f; }
        .delivery-option:hover { border-color: #2563eb; }
        .delivery-option.selected { border-color: #2563eb; background: #eff6ff; }
        .dark .delivery-option.selected { background: #172554; border-color: #3b82f6; }
        .delivery-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .delivery-radio-dot { width: 8px; height: 8px; border-radius: 50%; background: #2563eb; }
        .delivery-option-title { font-size: 0.9rem; font-weight: 600; color: #0f172a; margin-bottom: 2px; }
        .dark .delivery-option-title { color: #f1f5f9; }
        .delivery-option-desc { font-size: 0.8rem; color: #64748b; }
        .dark .delivery-option-desc { color: #94a3b8; }
        .delivery-option-fee { margin-left: auto; font-size: 0.85rem; font-weight: 700; color: #2563eb; white-space: nowrap; }

        .checkout-field { margin-bottom: 16px; }
        .checkout-label { display: block; font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 6px; }
        .dark .checkout-label { color: #94a3b8; }
        .checkout-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 0.875rem; color: #0f172a; background: white; outline: none; transition: border 0.2s; font-family: inherit; resize: vertical; }
        .dark .checkout-input { background: #0a1628; border-color: #1e3a5f; color: #f1f5f9; }
        .checkout-input:focus { border-color: #2563eb; }

        .order-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
        .dark .order-item { border-color: #1e3a5f; }
        .order-item:last-child { border-bottom: none; }
        .order-item-img { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; background: #e2e8f0; flex-shrink: 0; }
        .dark .order-item-img { background: #1e3a5f; }
        .order-item-title { font-size: 0.875rem; font-weight: 600; color: #0f172a; margin-bottom: 2px; }
        .dark .order-item-title { color: #f1f5f9; }
        .order-item-qty { font-size: 0.78rem; color: #64748b; }
        .order-item-price { margin-left: auto; font-size: 0.9rem; font-weight: 700; color: #2563eb; white-space: nowrap; }

        .summary-panel { background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; }
        .dark .summary-panel { background: #0f1a35; border-color: #1e3a5f; }
        @media (min-width: 1024px) { .summary-panel { width: 300px; flex-shrink: 0; position: sticky; top: 90px; } }
        .summary-row { display: flex; justify-content: space-between; font-size: 0.875rem; color: #475569; margin-bottom: 10px; }
        .dark .summary-row { color: #94a3b8; }
        .summary-divider { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
        .dark .summary-divider { border-color: #1e3a5f; }
        .summary-total { display: flex; justify-content: space-between; font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: 20px; }
        .dark .summary-total { color: #f1f5f9; }

        .checkout-btn { width: 100%; padding: 13px; background: #2563eb; color: white; border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; transition: background 0.2s; font-family: inherit; }
        .checkout-btn:hover:not(:disabled) { background: #1d4ed8; }
        .checkout-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .checkout-btn-outline { width: 100%; padding: 12px; background: transparent; color: #475569; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.2s; font-family: inherit; }
        .dark .checkout-btn-outline { color: #94a3b8; border-color: #1e3a5f; }
        .checkout-btn-outline:hover { border-color: #2563eb; color: #2563eb; }
        .checkout-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 0.8rem; color: #ef4444; margin-bottom: 14px; }
        .dark .checkout-error { background: #1a0a0a; border-color: #7f1d1d; }

        .payment-box { background: linear-gradient(135deg, #1e40af, #2563eb); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 20px; }
        .payment-box-title { font-size: 0.8rem; color: rgba(255,255,255,0.75); margin-bottom: 6px; font-weight: 500; }
        .payment-total-big { font-size: 2rem; font-weight: 800; color: white; font-family: var(--font-sora), sans-serif; margin-bottom: 6px; }
        .payment-box-sub { font-size: 0.78rem; color: rgba(255,255,255,0.7); }

        .success-screen { text-align: center; padding: 20px 0; }
        .success-icon { width: 72px; height: 72px; border-radius: 50%; background: #f0fdf4; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .dark .success-icon { background: #052e16; }
        .success-title { font-family: var(--font-sora), sans-serif; font-size: 1.4rem; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
        .dark .success-title { color: #f1f5f9; }
        .success-sub { font-size: 0.875rem; color: #64748b; margin-bottom: 28px; line-height: 1.6; }
        .dark .success-sub { color: #94a3b8; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="checkout-page">
        <div className="checkout-mobile-header">
          <Link href="/cart" style={{ color: "white" }}>
            <ArrowLeft size={20} />
          </Link>
          <span style={{ fontFamily: "var(--font-sora)", fontWeight: 700, fontSize: "1rem" }}>
            Checkout
          </span>
        </div>

        <div className="checkout-container">
          <h1 className="checkout-desktop-title">Checkout</h1>

          {/* Progress steps */}
          <div className="checkout-steps">
            <div className="checkout-step">
              <div className={`step-circle ${step === "details" ? "active" : "done"}`}>
                {step === "details" ? "1" : "✓"}
              </div>
              <span className={`step-label ${step === "details" ? "active" : "done"}`}>Details</span>
            </div>
            <div className={`step-line ${step !== "details" ? "done" : ""}`} />
            <div className="checkout-step">
              <div className={`step-circle ${step === "payment" ? "active" : step === "success" ? "done" : "inactive"}`}>
                {step === "success" ? "✓" : "2"}
              </div>
              <span className={`step-label ${step === "payment" ? "active" : step === "success" ? "done" : "inactive"}`}>Payment</span>
            </div>
            <div className={`step-line ${step === "success" ? "done" : ""}`} />
            <div className="checkout-step">
              <div className={`step-circle ${step === "success" ? "done" : "inactive"}`}>
                {step === "success" ? "✓" : "3"}
              </div>
              <span className={`step-label ${step === "success" ? "done" : "inactive"}`}>Confirmed</span>
            </div>
          </div>

          {/* ── STEP 1: Details ── */}
          {step === "details" && (
            <div className="checkout-layout">
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="checkout-panel">
                  <div className="panel-title">
                    <MapPin size={18} color="#2563eb" />
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

                {error && <div className="checkout-error">{error}</div>}

                <button className="checkout-btn" disabled={loading} onClick={handlePayWithPaystack}>
                  {loading ? (
                    <><Loader2 size={16} className="spin" /> Saving your order...</>
                  ) : (
                    <>Pay {formatPrice(total)} with Paystack</>
                  )}
                </button>
                <button className="checkout-btn-outline" onClick={() => setStep("details")}>
                  Back to Details
                </button>
              </div>

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