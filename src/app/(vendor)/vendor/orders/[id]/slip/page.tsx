import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getVendorOrder, pick, naira, fmtDate, itemSubtotal } from '@/lib/vendor-orders'
import PrintButton from './PrintButton'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/vendor/orders/${id}/slip`)

  const data = await getVendorOrder(supabase, id, user.id)
  if (!data) notFound()
  const { seller, order, items, products } = data

  const productById = new Map(products.map((p) => [p.id, p]))
  const store = pick(seller, ['store_name', 'business_name', 'name']) ?? 'Vendor'
  const ref = String(order.id).slice(0, 8).toUpperCase()
  const buyer = pick(order, ['full_name', 'buyer_name', 'customer_name', 'name'])
  const phone = pick(order, ['phone_number', 'phone', 'buyer_phone', 'delivery_phone', 'contact_phone'])
  const method = pick(order, ['delivery_method', 'fulfillment_method', 'delivery_type'])
  const address = pick(order, ['delivery_address', 'address', 'shipping_address'])
  const notes = pick(order, ['delivery_notes', 'notes', 'note'])
  const total = items.reduce((sum, i) => sum + itemSubtotal(i), 0)

  return (
    <div className="slip-overlay">
      <style>{css}</style>

      <div className="slip-toolbar">
        <Link href={`/vendor/orders/${order.id}`} className="slip-back"><ArrowLeft size={15} />Back to order</Link>
        <PrintButton />
      </div>

      <section className="slip">
        <header className="slip-head">
          <div>
            <p className="slip-label">CampusMart / Packing slip</p>
            <h1>{String(store)}</h1>
          </div>
          <div className="slip-right">
            <p><strong>Order #{ref}</strong></p>
            <p>{fmtDate(order.created_at)}</p>
          </div>
        </header>

        <div className="slip-block">
          <p className="slip-label">Deliver to</p>
          {buyer && <p><strong>{String(buyer)}</strong></p>}
          {phone && <p>{String(phone)}</p>}
          {(method || address) && <p>{[method, address].filter(Boolean).join(', ')}</p>}
          {notes && <p className="slip-note">Note: {String(notes)}</p>}
        </div>

        <table className="slip-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{productById.get(it.product_id)?.title ?? 'Product'}</td>
                <td className="num">{it.quantity}</td>
                <td className="num">{naira(itemSubtotal(it))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="num">{naira(total)}</td>
            </tr>
          </tfoot>
        </table>

        <footer className="slip-foot">Thank you for shopping on CampusMart.</footer>
      </section>
    </div>
  )
}

const css = `
.slip-overlay{position:fixed;inset:0;z-index:9999;background:#eef1f7;overflow:auto;font-family:'DM Sans',sans-serif;color:#0f1a35}
.slip-toolbar{max-width:794px;margin:20px auto 0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 16px}
.slip-back{display:inline-flex;align-items:center;gap:7px;color:#1d4ed8;text-decoration:none;font-size:12px}
.slip-print-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:#2563eb;color:#fff;border:0;border-radius:10px;font:inherit;font-weight:600;cursor:pointer}
.slip{max-width:794px;margin:16px auto 40px;background:#fff;padding:48px;box-shadow:0 8px 30px rgba(15,26,53,.12);min-height:600px}
.slip-head{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0f1a35;padding-bottom:20px;margin-bottom:24px}
.slip-head h1{font-family:'Sora',sans-serif;font-size:1.7rem;margin:4px 0 0;letter-spacing:-.02em}
.slip-head p{margin:0 0 4px}
.slip-right{text-align:right;font-size:.92rem}
.slip-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:#5b6b8c;margin:0 0 6px}
.slip-block{margin-bottom:28px;font-size:.95rem;line-height:1.55}
.slip-block p{margin:0}
.slip-note{margin-top:8px!important;padding:8px 10px;background:#f3f5fa;border-radius:6px;font-size:.88rem}
.slip-table{width:100%;border-collapse:collapse;font-size:.95rem}
.slip-table th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#5b6b8c;padding:8px 0;border-bottom:1px solid #cfd6e6}
.slip-table td{padding:12px 0;border-bottom:1px solid #e6eaf3}
.slip-table .num{text-align:right;white-space:nowrap}
.slip-table tfoot td{font-weight:700;border-bottom:0;border-top:2px solid #0f1a35;padding-top:14px}
.slip-foot{margin-top:48px;text-align:center;font-size:.85rem;color:#5b6b8c}
@media(max-width:600px){.slip{padding:26px 20px;margin:15px 12px 35px;min-height:500px;border-radius:8px}.slip-head{flex-direction:column;gap:12px}.slip-right{text-align:left;font-size:12px}.slip-head h1{font-size:22px}.slip-table{font-size:12px}.slip-table td{padding:13px 5px 13px 0}.slip-print-btn{font-size:12px}}
@media print{
  body *{visibility:hidden}
  .slip,.slip *{visibility:visible}
  .slip{position:absolute;left:0;top:0;width:100%;margin:0;padding:24px;box-shadow:none}
  .slip-overlay{position:static;background:#fff;overflow:visible}
  @page{size:A4;margin:12mm}
}
`
