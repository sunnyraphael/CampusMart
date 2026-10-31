import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CleanupButton from './CleanupButton'
import VendorListingsClient from './VendorListingsClient'

export default async function VendorListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string }>
}) {
  const { created, updated } = await searchParams // Next.js 16: also a Promise

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
    .select('id, title, price, images, status, stock_quantity, created_at, compare_at_price, sale_ends_at, availability')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })

  return (
    <>
    <CleanupButton />
    <VendorListingsClient
      products={products ?? []}
      notice={created ? 'created' : updated ? 'updated' : null}
    />
    </>
  )
}