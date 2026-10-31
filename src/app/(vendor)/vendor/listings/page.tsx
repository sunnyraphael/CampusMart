import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VendorListingsClient from './VendorListingsClient'

export default async function VendorListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; stock?: string; status?: string }>
}) {
  const { created, updated, stock, status } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, store_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (sellerError) throw new Error('Could not load your store.')
  if (!seller) redirect('/vendor/onboarding')

  const { data: products, error } = await supabase
    .from('products')
    .select('id, title, price, images, status, stock_quantity, created_at, compare_at_price, sale_ends_at, availability')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error('Could not load your listings.')
  // eslint-disable-next-line react-hooks/purity -- Snapshot the server request time once for stable client hydration.
  const requestTime = Date.now()
  return (
    <VendorListingsClient
      key={`${stock ?? 'all'}-${status ?? 'all'}`}
      products={products ?? []}
      now={requestTime}
      notice={created ? 'created' : updated ? 'updated' : null}
      initialFilter={status === 'active' || status === 'draft' ? status : 'all'}
      initialStock={stock === 'low' || stock === 'out' ? stock : 'all'}
    />
  )
}
