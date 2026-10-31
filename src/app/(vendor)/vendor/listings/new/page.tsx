import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ListingForm from '../ListingForm'

export default async function NewListingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (sellerError) throw new Error('Could not load your store.')
  if (!seller) redirect('/vendor/onboarding')

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw new Error('Could not load listing categories.')
  return <ListingForm mode="create" sellerId={seller.id} categories={categories ?? []} />
}
