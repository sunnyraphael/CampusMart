export type OverviewProduct = { id: string; title: string; images: string[] | null; status: string; stock_quantity: number; availability?: string | null }
export type OverviewItem = { id: string; order_id: string; product_id: string | null; quantity: number; subtotal: number | null; payout_amount: number | null; fulfillment_status: string; released_at: string | null }
export type OverviewOrder = { id: string; created_at: string }
const money = (value: number | null | undefined) => Number(value ?? 0)
const lagosDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const rank = ['pending', 'confirmed', 'shipped', 'delivered', 'received']

export function buildOverview(products: OverviewProduct[], allItems: OverviewItem[], orders: OverviewOrder[], now = new Date()) {
  const orderById = new Map(orders.map(o => [o.id, o]))
  const productById = new Map(products.map(p => [p.id, p]))
  const items = allItems.filter(i => orderById.has(i.order_id))
  const sales = items.filter(i => !['refunded', 'cancelled'].includes(i.fulfillment_status))
  const groups = new Map<string, OverviewItem[]>()
  for (const item of items) groups.set(item.order_id, [...(groups.get(item.order_id) ?? []), item])
  const recentOrders = [...groups].map(([id, rows]) => {
    const states = rows.map(i => i.fulfillment_status)
    const active = states.filter(s => !['refunded', 'cancelled'].includes(s))
    const status = states.includes('disputed') ? 'disputed' : active.length ? rank[Math.min(...active.map(s => Math.max(rank.indexOf(s), 0)))] : 'refunded'
    const first = productById.get(rows[0].product_id ?? '')
    return { id, productName: first?.title ?? 'Unavailable listing', image: first?.images?.[0] ?? null, status, itemCount: rows.length, amount: rows.reduce((sum, i) => sum + money(i.subtotal), 0), createdAt: orderById.get(id)!.created_at }
  }).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5)
  const totals = new Map<string, { id: string; name: string; image: string | null; sold: number; revenue: number }>()
  for (const item of sales) {
    const key = item.product_id ?? 'deleted'
    const product = productById.get(key)
    const row = totals.get(key) ?? { id: key, name: product?.title ?? 'Unavailable listing', image: product?.images?.[0] ?? null, sold: 0, revenue: 0 }
    row.sold += money(item.quantity); row.revenue += money(item.subtotal); totals.set(key, row)
  }
  const chartData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 86400000)
    const day = lagosDay(date)
    return { date: date.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' }), sales: sales.filter(i => lagosDay(new Date(orderById.get(i.order_id)!.created_at)) === day).reduce((sum, i) => sum + money(i.subtotal), 0) }
  })
  return {
    stats: { totalSales: sales.reduce((sum, i) => sum + money(i.subtotal), 0), totalOrders: groups.size, unitsSold: sales.reduce((sum, i) => sum + money(i.quantity), 0), activeListings: products.filter(p => p.status === 'active').length },
    attention: { orders: new Set(items.filter(i => ['pending', 'confirmed', 'shipped'].includes(i.fulfillment_status)).map(i => i.order_id)).size, lowStock: products.filter(p => p.status === 'active' && p.availability !== 'pre_order' && p.stock_quantity <= 3).length, drafts: products.filter(p => p.status === 'draft').length },
    chartData, recentOrders, topProducts: [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 4),
  }
}
export type Overview = ReturnType<typeof buildOverview>
