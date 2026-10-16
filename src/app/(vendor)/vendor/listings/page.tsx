import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VendorListingsClient from './VendorListingsClient'

export default async function VendorListingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, store_name')
    .eq('user_id', user.id)
    .single()

  if (!seller) redirect('/vendor/onboarding')

  const { data: products } = await supabase
    .from('products')
    .select('id, title, price, images, status, stock_quantity, created_at')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })

  return <VendorListingsClient products={products ?? []} />
}