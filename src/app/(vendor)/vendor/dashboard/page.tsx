import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VendorDashboardClient from './VendorDashboardClient'

async function getVendorStats(sellerId: string) {
  const supabase = await createClient()

  // 1. Get all products belonging to this vendor
  const { data: products } = await supabase
    .from('products')
    .select('id, title, images, price')
    .eq('seller_id', sellerId)

  const productIds = (products ?? []).map((p: any) => p.id)

  if (productIds.length === 0) {
    return { stats: null, recentOrders: [], topProducts: [], chartData: [], products: [] }
  }

  // 2. Get all order_items for this vendor's products, joined to orders
  const { data: orderItems } = await supabase
    .from('order_items')
    .select(`
      id,
      quantity,
      subtotal,
      product_id,
      products ( title, images ),
      orders (
        id,
        status,
        payment_status,
        created_at,
        total_amount,
        user_id
      )
    `)
    .in('product_id', productIds)
    .order('id', { ascending: false })

  const items = (orderItems ?? []) as any[]

  // 3. Aggregate stats
  // Unique order IDs this vendor has sales in
  const orderMap = new Map<string, any>()
  for (const item of items) {
    if (item.orders?.id) orderMap.set(item.orders.id, item.orders)
  }
  const uniqueOrders = Array.from(orderMap.values())

  const totalSales = items.reduce((sum: number, i: any) => sum + (i.subtotal ?? 0), 0)
  const totalOrders = uniqueOrders.length
  const totalProductsSold = items.reduce((sum: number, i: any) => sum + (i.quantity ?? 0), 0)

  // 4. Recent orders (last 5 unique orders with product info)
  const recentOrders = uniqueOrders
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((order) => {
      const orderItemsForOrder = items.filter((i: any) => i.orders?.id === order.id)
      const firstItem = orderItemsForOrder[0]
      return {
        id: order.id,
        shortId: 'CM' + order.id.slice(0, 6).toUpperCase(),
        productName: firstItem?.products?.title ?? 'Product',
        productImage: firstItem?.products?.images?.[0] ?? null,
        itemCount: orderItemsForOrder.length,
        status: order.status,
        amount: orderItemsForOrder.reduce((s: number, i: any) => s + (i.subtotal ?? 0), 0),
        createdAt: order.created_at,
      }
    })

  // 5. Top products by revenue
  const productRevenue = new Map<string, { name: string; image: string | null; sold: number; revenue: number }>()
  for (const item of items) {
    const pid = item.product_id
    const existing = productRevenue.get(pid)
    if (existing) {
      existing.sold += item.quantity ?? 0
      existing.revenue += item.subtotal ?? 0
    } else {
      productRevenue.set(pid, {
        name: item.products?.title ?? 'Product',
        image: item.products?.images?.[0] ?? null,
        sold: item.quantity ?? 0,
        revenue: item.subtotal ?? 0,
      })
    }
  }
  const topProducts = Array.from(productRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4)

  // 6. Chart data — daily sales for last 7 days
  const chartData = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10) // "2024-05-12"
    const label = date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })

    const daySales = items
      .filter((item: any) => item.orders?.created_at?.slice(0, 10) === dateStr)
      .reduce((sum: number, item: any) => sum + (item.subtotal ?? 0), 0)

    chartData.push({ date: label, sales: daySales })
  }

  return {
    stats: { totalSales, totalOrders, totalProductsSold, storeViews: 0 },
    recentOrders,
    topProducts,
    chartData,
    products: products ?? [],
  }
}

export default async function VendorDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { stats, recentOrders, topProducts, chartData, products } = await getVendorStats(user.id)

  return (
    <VendorDashboardClient
      stats={stats}
      recentOrders={recentOrders}
      topProducts={topProducts}
      chartData={chartData}
      productCount={products.length}
      vendorName={user.user_metadata?.full_name ?? user.email ?? 'Vendor'}
    />
  )
}