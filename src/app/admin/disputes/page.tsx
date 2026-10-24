import { createClient } from '@/lib/supabase/server'
import DisputesClient from './DisputesClient'

export const dynamic = 'force-dynamic'

type Row = {
  item_id: string
  order_id: string
  product_title: string | null
  quantity: number
  subtotal: number
  dispute_reason: string | null
  ordered_at: string | null
  buyer_name: string | null
  buyer_email: string | null
  buyer_phone: string | null
  delivery_method: string | null
  store_name: string | null
  seller_phone: string | null
  resolution: string | null
  resolved_at: string | null
  admin_note: string | null
}

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  // In current Next.js, searchParams is a promise, so we wait for it
  const { view } = await searchParams
  const resolved = view === 'resolved'

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_dispute_queue', { p_resolved: resolved })
  const rows = (data ?? []) as Row[]

  const items = rows.map((r) => ({
    itemId: r.item_id,
    orderId: r.order_id,
    product: r.product_title ?? 'Product',
    quantity: r.quantity,
    subtotal: Number(r.subtotal ?? 0),
    reason: r.dispute_reason,
    orderedAt: r.ordered_at,
    buyerName: r.buyer_name,
    buyerEmail: r.buyer_email,
    buyerPhone: r.buyer_phone,
    delivery: r.delivery_method,
    store: r.store_name ?? 'Store',
    sellerPhone: r.seller_phone,
    resolution: r.resolution,
    resolvedAt: r.resolved_at,
    note: r.admin_note,
  }))

  return <DisputesClient items={items} resolved={resolved} loadError={error?.message ?? null} />
}