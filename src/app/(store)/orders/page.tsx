import { createClient } from "@/lib/supabase/server"
import { formatPrice, formatRelativeTime } from "@/lib/utils/format"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  ShoppingBag, Package, Truck, CheckCircle2,
  XCircle, Clock, ArrowLeft, ReceiptText, MapPin
} from "lucide-react"

async function getOrders(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (
        id,
        quantity,
        unit_price,
        subtotal,
        product_id,
        products (
          title,
          images
        )
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  return (data as any[]) ?? []
}

function getStatusConfig(status: string) {
  switch (status) {
    case "pending":
      return { label: "Pending", color: "#d97706", bg: "#fffbeb", Icon: Clock }
    case "confirmed":
      return { label: "Confirmed", color: "#2563eb", bg: "#eff6ff", Icon: CheckCircle2 }
    case "processing":
      return { label: "Processing", color: "#9333ea", bg: "#faf5ff", Icon: Package }
    case "shipped":
      return { label: "Shipped", color: "#0891b2", bg: "#ecfeff", Icon: Truck }
    case "delivered":
      return { label: "Delivered", color: "#16a34a", bg: "#f0fdf4", Icon: CheckCircle2 }
    case "cancelled":
      return { label: "Cancelled", color: "#dc2626", bg: "#fef2f2", Icon: XCircle }
    default:
      return { label: status, color: "#6b7280", bg: "#f9fafb", Icon: Clock }
  }
}

function getPaymentConfig(status: string) {
  switch (status) {
    case "paid":
      return { label: "Paid", color: "#16a34a", bg: "#f0fdf4" }
    case "pending":
      return { label: "Payment Pending", color: "#d97706", bg: "#fffbeb" }
    case "failed":
      return { label: "Payment Failed", color: "#dc2626", bg: "#fef2f2" }
    case "refunded":
      return { label: "Refunded", color: "#6b7280", bg: "#f9fafb" }
    default:
      return { label: status, color: "#6b7280", bg: "#f9fafb" }
  }
}

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const orders = await getOrders(user.id)

  const activeCount = orders.filter(o =>
    ["pending","confirmed","processing","shipped"].includes(o.status)
  ).length
  const deliveredCount = orders.filter(o => o.status === "delivered").length
  const cancelledCount = orders.filter(o => o.status === "cancelled").length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .op { font-family: 'DM Sans', sans-serif; background: #f8faff; min-height: 100vh; padding-bottom: 80px; }
        .ow { max-width: 900px; margin: 0 auto; padding: 0 20px; }
        @media(min-width:640px){ .ow { padding: 0 32px; } }

        .op-header { padding: 32px 0 24px; }
        .op-back { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#6b7280; text-decoration:none; margin-bottom:12px; transition:color .2s; }
        .op-back:hover { color:#2563eb; }
        .op-title { font-family:'Sora',sans-serif; font-size:clamp(1.6rem,3vw,2rem); font-weight:800; color:#0a0f2e; letter-spacing:-.02em; margin:0 0 4px; }
        .op-sub { font-size:14px; color:#9ca3af; }

        .op-pills { display:flex; gap:10px; margin-bottom:28px; flex-wrap:wrap; }
        .op-pill { display:flex; align-items:center; gap:8px; padding:7px 16px; border-radius:100px; background:#fff; border:1.5px solid #f1f5f9; font-size:13px; font-weight:600; color:#374151; box-shadow:0 1px 4px rgba(0,0,0,.04); }
        .op-pill-dot { width:8px; height:8px; border-radius:50%; }

        .oc { background:#fff; border-radius:20px; border:1.5px solid #f1f5f9; margin-bottom:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.04); transition:box-shadow .25s,border-color .25s; }
        .oc:hover { box-shadow:0 8px 32px rgba(0,0,0,.09); border-color:#e0e7ff; }

        .oc-head { padding:16px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; border-bottom:1.5px solid #f8faff; background:#fdfdff; }
        .oc-id-row { display:flex; align-items:center; gap:10px; }
        .oc-id-icon { width:34px; height:34px; border-radius:10px; background:#eff6ff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .oc-id-label { font-size:11px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; }
        .oc-id-val { font-family:'Sora',sans-serif; font-size:13px; font-weight:700; color:#0a0f2e; }
        .oc-head-right { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }

        .status-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:100px; font-size:12px; font-weight:700; }
        .pay-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:100px; font-size:11px; font-weight:600; }
        .oc-date { font-size:12px; color:#9ca3af; white-space:nowrap; }

        .oc-items { padding:16px 20px; display:flex; flex-direction:column; gap:12px; }
        .oi-row { display:flex; align-items:center; gap:14px; }
        .oi-img { width:56px; height:56px; border-radius:12px; overflow:hidden; background:linear-gradient(135deg,#f8faff,#eff2ff); flex-shrink:0; display:flex; align-items:center; justify-content:center; border:1px solid #f1f5f9; }
        .oi-img img { width:100%; height:100%; object-fit:cover; }
        .oi-info { flex:1; min-width:0; }
        .oi-title { font-size:14px; font-weight:600; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:3px; }
        .oi-meta { font-size:12px; color:#9ca3af; }
        .oi-subtotal { font-family:'Sora',sans-serif; font-size:14px; font-weight:700; color:#0a0f2e; flex-shrink:0; }

        .oc-more { font-size:12px; color:#9ca3af; padding:0 20px 12px; font-style:italic; }

        .oc-foot { padding:14px 20px; display:flex; align-items:center; justify-content:space-between; border-top:1.5px solid #f8faff; background:#fdfdff; flex-wrap:wrap; gap:10px; }
        .oc-delivery { display:flex; align-items:center; gap:6px; font-size:12px; color:#6b7280; max-width:55%; }
        .oc-delivery-txt { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .oc-total-row { display:flex; align-items:center; gap:8px; }
        .oc-total-lbl { font-size:13px; color:#9ca3af; }
        .oc-total-val { font-family:'Sora',sans-serif; font-size:18px; font-weight:800; color:#0a0f2e; }

        .empty-state { text-align:center; padding:80px 24px; background:#fff; border-radius:24px; border:2px dashed #e0e7ff; }
        .empty-icon { width:72px; height:72px; border-radius:20px; background:linear-gradient(135deg,#eff6ff,#e0e7ff); display:flex; align-items:center; justify-content:center; margin:0 auto 20px; }
        .empty-title { font-family:'Sora',sans-serif; font-size:1.25rem; font-weight:800; color:#0a0f2e; margin-bottom:8px; }
        .empty-sub { font-size:14px; color:#9ca3af; margin-bottom:28px; line-height:1.6; }
        .btn-shop { display:inline-flex; align-items:center; gap:8px; padding:12px 28px; border-radius:12px; background:linear-gradient(135deg,#2563eb,#4f46e5); color:#fff; font-size:14px; font-weight:600; text-decoration:none; transition:all .2s; box-shadow:0 4px 16px rgba(37,99,235,.3); }
        .btn-shop:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(37,99,235,.4); }
      `}</style>

      <div className="op">
        <div className="ow">

          <div className="op-header">
            <Link href="/" className="op-back">
              <ArrowLeft size={14} /> Back to home
            </Link>
            <h1 className="op-title">My Orders</h1>
            <p className="op-sub">
              {orders.length === 0
                ? "No orders placed yet"
                : `${orders.length} order${orders.length !== 1 ? "s" : ""} placed`}
            </p>
          </div>

          {orders.length > 0 && (
            <div className="op-pills">
              {activeCount > 0 && (
                <div className="op-pill">
                  <span className="op-pill-dot" style={{ background: "#2563eb" }} />
                  {activeCount} Active
                </div>
              )}
              {deliveredCount > 0 && (
                <div className="op-pill">
                  <span className="op-pill-dot" style={{ background: "#16a34a" }} />
                  {deliveredCount} Delivered
                </div>
              )}
              {cancelledCount > 0 && (
                <div className="op-pill">
                  <span className="op-pill-dot" style={{ background: "#dc2626" }} />
                  {cancelledCount} Cancelled
                </div>
              )}
            </div>
          )}

          {orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ShoppingBag size={32} color="#2563eb" />
              </div>
              <div className="empty-title">No orders yet</div>
              <p className="empty-sub">
                You haven't placed any orders.<br />
                Browse the marketplace and find something you love!
              </p>
              <Link href="/products" className="btn-shop">
                <ShoppingBag size={16} />
                Start Shopping
              </Link>
            </div>
          ) : (
            orders.map((order: any) => {
              const { label: statusLabel, color: statusColor, bg: statusBg, Icon: StatusIcon } = getStatusConfig(order.status)
              const { label: payLabel, color: payColor, bg: payBg } = getPaymentConfig(order.payment_status)
              const items: any[] = order.order_items ?? []
              const visible = items.slice(0, 3)
              const hiddenCount = items.length - visible.length

              return (
                <div key={order.id} className="oc">
                  <div className="oc-head">
                    <div className="oc-id-row">
                      <div className="oc-id-icon">
                        <ReceiptText size={16} color="#2563eb" />
                      </div>
                      <div>
                        <div className="oc-id-label">Order ID</div>
                        <div className="oc-id-val">#{order.id.slice(0, 8).toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="oc-head-right">
                      <span className="status-badge" style={{ color: statusColor, background: statusBg }}>
                        <StatusIcon size={12} />
                        {statusLabel}
                      </span>
                      <span className="pay-badge" style={{ color: payColor, background: payBg }}>
                        {payLabel}
                      </span>
                      <span className="oc-date">{formatRelativeTime(order.created_at)}</span>
                    </div>
                  </div>

                  <div className="oc-items">
                    {visible.map((item: any) => (
                      <div key={item.id} className="oi-row">
                        <div className="oi-img">
                          {item.products?.images?.[0]
                            ? <img src={item.products.images[0]} alt={item.products?.title} />
                            : <Package size={22} color="#cbd5e1" />
                          }
                        </div>
                        <div className="oi-info">
                          <div className="oi-title">{item.products?.title ?? "Product"}</div>
                          <div className="oi-meta">Qty: {item.quantity} × {formatPrice(item.unit_price)}</div>
                        </div>
                        <div className="oi-subtotal">{formatPrice(item.subtotal)}</div>
                      </div>
                    ))}
                  </div>

                  {hiddenCount > 0 && (
                    <div className="oc-more">+{hiddenCount} more item{hiddenCount !== 1 ? "s" : ""}</div>
                  )}

                  <div className="oc-foot">
                    <div className="oc-delivery">
                      <MapPin size={13} color="#9ca3af" style={{ flexShrink: 0 }} />
                      <span className="oc-delivery-txt">
                        {order.delivery_address ?? "Campus Pickup"}
                      </span>
                    </div>
                    <div className="oc-total-row">
                      <span className="oc-total-lbl">Total</span>
                      <span className="oc-total-val">{formatPrice(order.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}

        </div>
      </div>
    </>
  )
}
