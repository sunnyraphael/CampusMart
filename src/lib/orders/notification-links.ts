// Resolve the recipient's relationship to each order, never their account role.
// A vendor's own purchase belongs in the buyer view, even if they also sell.
export function notificationOrderLinks(userId: string, orders: { id: string; user_id: string | null }[], saleOrderIds: string[]) {
  const sales = new Set(saleOrderIds)
  const links: Record<string, string> = {}
  if (!userId) return links
  for (const order of orders) {
    if (order.user_id === userId) links[order.id] = `/orders/${order.id}`
    else if (sales.has(order.id)) links[order.id] = `/vendor/orders/${order.id}`
  }
  return links
}
