import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VendorOrdersClient from './VendorOrdersClient'

export const dynamic = 'force-dynamic'

export default async function VendorOrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/vendor/orders')

  // products.seller_id and order_items.seller_id point to sellers.id, NOT user.id
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (sellerError) throw new Error('Could not load your store.')
  if (!seller) redirect('/vendor/onboarding')

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('seller_id', seller.id)

  if (itemsError) throw new Error('Could not load your orders.')
  const allItems = items ?? []
  const orderIds = [...new Set(allItems.map((i) => i.order_id))]
  const productIds = [...new Set(allItems.map((i) => i.product_id))]

  // Separate queries instead of joins, so we never depend on foreign key names
  const [ordersRes, productsRes] = await Promise.all([
    orderIds.length
      ? supabase.from('orders').select('*').in('id', orderIds).eq('payment_status', 'paid')
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    productIds.length
      ? supabase.from('products').select('*').in('id', productIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ])

  if (ordersRes.error || productsRes.error) throw new Error('Could not load your order details.')
  const orders = ordersRes.data ?? []
  const paidIds = new Set(orders.map((o) => o.id))
  const paidItems = allItems.filter((i) => paidIds.has(i.order_id))

  return (
    <VendorOrdersClient
      items={paidItems}
      orders={orders}
      products={productsRes.data ?? []}
    />
  )
}
