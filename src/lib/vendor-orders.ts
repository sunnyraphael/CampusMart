import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>

// Takes the first field that exists, because column names vary between tables
export const pick = (obj: Row | undefined, keys: string[]) => {
  if (!obj) return undefined
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  return undefined
}

export const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG')

export const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export const itemSubtotal = (i: Row) =>
  Number(
    pick(i, ['subtotal', 'total_price']) ??
      Number(pick(i, ['unit_price', 'price']) ?? 0) * Number(i.quantity ?? 1)
  )

// Returns this vendor's items inside one paid order, or null if it isn't theirs
export async function getVendorOrder(supabase: SupabaseClient, orderId: string, userId: string) {
  const { data: seller, error: sellerError } = await supabase.from('sellers').select('*').eq('user_id', userId).maybeSingle()
  if (sellerError) throw new Error('Could not load your store.')
  if (!seller) return null

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .eq('seller_id', seller.id)
  if (itemsError) throw new Error('Could not load your order items.')
  if (!items?.length) return null

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('payment_status', 'paid')
    .maybeSingle()
  if (orderError) throw new Error('Could not load your order.')
  if (!order) return null

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('id', items.map((i) => i.product_id))

  if (productsError) throw new Error('Could not load your order products.')
  return { seller, order, items, products: products ?? [] }
}
