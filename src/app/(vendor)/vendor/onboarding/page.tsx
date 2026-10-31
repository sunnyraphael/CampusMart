import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DataError } from '@/components/buyer/Page'
import OnboardingClient from './OnboardingClient'

export default async function VendorOnboardingPage() {
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login?redirectTo=%2Fstart-selling')
  const profile=await supabase.from('users').select('role').eq('id',user.id).maybeSingle()
  if(profile.error||!profile.data)return <DataError/>
  if(profile.data.role!=='vendor')redirect('/start-selling')
  const store=await supabase.from('sellers').select('id').eq('user_id',user.id).maybeSingle()
  if(store.error)return <DataError/>
  if(store.data)redirect('/vendor/dashboard')
  return <OnboardingClient/>
}
