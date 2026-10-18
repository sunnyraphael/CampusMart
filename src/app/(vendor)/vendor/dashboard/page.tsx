import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VendorDashboardClient from './VendorDashboardClient'

export const dynamic = 'force-dynamic'

const RANK = ['pending', 'confirmed', 'shipped', 'delivered', 'received']

// An order's status for this vendor comes from their items. A dispute wins,
// otherwise the least advanced item decides.
function orderStatus(statuses: string[]) {
  if (statuses.includes('disputed')) return 'disputed'
  return RANK[Math.min(...statuses.map((s) => Math.max(RANK.indexOf(s), 0)))]
}

async function getVendorStats(sellerId: string) {
  const supabase = await createClient()

  const [productsRes, itemsRes] = await Promise.all([
    supabase.from('products').select('id, title, images').eq('seller_id', sellerId),
    supabase.from('order_items').select('*').eq('seller_id', sellerId),
  ])
  const products = (productsRes.data ?? []) as any[]
  const allItems = (itemsRes.data ?? []) as any[]

  // Only count orders that were actually paid
  const orderIds = [...new Set(allItems.map((i) => i.order_id))]
  const { data: orderRows } = orderIds.length
    ? await supabase
        .from('orders')
        .select('id, created_at')
        .in('id', orderIds)
        .eq('payment_status', 'paid')
    : { data: [] as any[] }
  const orders = (orderRows ?? []) as any[]
  const orderById = new Map(orders.map((o) => [o.id, o]))
  const items = allItems.filter((i) => orderById.has(i.order_id))
  const productById = new Map(products.map((p) => [p.id, p]))

  // Money: paid out = already released to the wallet, pending = still on its way
  const totalSales = items.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
  const paidOut = items
    .filter((i) => i.released_at)
    .reduce((s, i) => s + Number(i.payout_amount ?? 0), 0)
  const pending = items
    .filter((i) => !i.released_at && i.fulfillment_status !== 'disputed')
    .reduce((s, i) => s + Math.round(Number(i.subtotal ?? 0) * 0.95), 0)

  // Recent orders: group this vendor's items by order
  const byOrder = new Map<string, any[]>()
  for (const it of items) {
    const list = byOrder.get(it.order_id) ?? []
    list.push(it)
    byOrder.set(it.order_id, list)
  }
  const recentOrders = [...byOrder.entries()]
    .map(([id, its]) => {
      const first = productById.get(its[0].product_id)
      return {
        id,
        shortId: 'CM' + id.slice(0, 6).toUpperCase(),
        productName: first?.title ?? 'Product',
        productImage: first?.images?.[0] ?? null,
        itemCount: its.length,
        status: orderStatus(its.map((i) => i.fulfillment_status)),
        amount: its.reduce((s, i) => s + Number(i.subtotal ?? 0), 0),
        createdAt: orderById.get(id).created_at as string,
      }
    })
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 5)

  // Top products by revenue
  const revenue = new Map<string, { name: string; image: string | null; sold: number; revenue: number }>()
  for (const it of items) {
    const p = productById.get(it.product_id)
    const key = it.product_id ?? 'deleted'
    const row = revenue.get(key) ?? { name: p?.title ?? 'Product', image: p?.images?.[0] ?? null, sold: 0, revenue: 0 }
    row.sold += Number(it.quantity ?? 0)
    row.revenue += Number(it.subtotal ?? 0)
    revenue.set(key, row)
  }
  const topProducts = [...revenue.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 4)

  // Chart: sales per day for the last 7 days
  const chartData = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10)
    const label = date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
    const sales = items
      .filter((it) => orderById.get(it.order_id)?.created_at?.slice(0, 10) === dateStr)
      .reduce((s, it) => s + Number(it.subtotal ?? 0), 0)
    chartData.push({ date: label, sales })
  }

  return {
    stats: {
      totalSales,
      totalOrders: orders.length,
      totalProductsSold: items.reduce((s, i) => s + Number(i.quantity ?? 0), 0),
      storeViews: 0,
      paidOut,
      pending,
    },
    recentOrders,
    topProducts,
    chartData,
    productCount: products.length,
  }
}

export default async function VendorDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // The key fix: products and order_items point to sellers.id, NOT user.id
  const { data: seller } = await supabase.from('sellers').select('id').eq('user_id', user.id).single()
  if (!seller) redirect('/vendor/onboarding')

  const { stats, recentOrders, topProducts, chartData, productCount } = await getVendorStats(seller.id)

  return (
    <VendorDashboardClient
      stats={stats}
      recentOrders={recentOrders}
      topProducts={topProducts}
      chartData={chartData}
      productCount={productCount}
      vendorName={user.user_metadata?.full_name ?? user.email ?? 'Vendor'}
    />
  )
}