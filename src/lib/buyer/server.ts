import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function buyerSession(path: string) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect(`/login?redirectTo=${encodeURIComponent(path)}`)
  return { supabase, user }
}

export const CARD_SELECT = `
  id, title, price, images, avg_rating, total_reviews, stock_quantity,
  compare_at_price, sale_ends_at, condition, availability, delivery_days,
  categories(name, slug), sellers:public_vendors(store_name, is_verified)
`
