import 'server-only'
import {adminReadFetch} from './read-fetch'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const adminSession = cache(async () => {
  const supabase = await createClient(adminReadFetch)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=%2Fadmin')
  const { data, error } = await supabase.rpc('is_admin')
  if (error || data !== true) {
    const membership=await supabase.rpc('cm_admin_membership')
    if(membership.data===true)redirect('/admin-security')
    notFound()
  }
  return { supabase, user }
})
