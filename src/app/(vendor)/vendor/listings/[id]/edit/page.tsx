import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ListingForm from '../../ListingForm'

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params // Next.js 16: params is a Promise

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!seller) redirect('/vendor/onboarding')

  // Filtering by seller_id means a vendor can only open their own listing
  const { data: product } = await supabase
    .from('products')
    .select(
      'id, title, description, category_id, price, stock_quantity, images, status, compare_at_price, sale_ends_at, condition, availability, delivery_days'
    )
    .eq('id', id)
    .eq('seller_id', seller.id)
    .maybeSingle()

  if (!product) notFound()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <ListingForm
      mode="edit"
      sellerId={seller.id}
      categories={categories ?? []}
      initial={product}
    />
  )
}