import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewListingClient from './NewListingClient'

export default async function NewListingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, store_name')
    .eq('user_id', user.id)
    .single()

  if (!seller) redirect('/vendor/onboarding')

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <NewListingClient
      sellerId={seller.id}
      categories={categories ?? []}
    />
  )
}