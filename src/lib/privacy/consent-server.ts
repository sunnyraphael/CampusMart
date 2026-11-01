import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeRedirect } from '@/lib/buyer/validation'
import type { ConsentStatus } from './consent'

export async function requireMarketplacePermission(next:string,vendor=false) {
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)redirect(`/login?redirectTo=${encodeURIComponent(next)}`)
  const {data,error}=await supabase.rpc('cm_consent_status')
  const status=data as ConsentStatus|null
  if(error||!status?.eligible||(vendor&&!status.vendor_terms))redirect(`/consent?next=${encodeURIComponent(safeRedirect(next))}${vendor?'&vendor=1':''}`)
  return {supabase,user,status}
}
