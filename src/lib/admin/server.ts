import 'server-only'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const adminSession = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=%2Fadmin')
  const { data, error } = await supabase.rpc('is_admin')
  if (error || data !== true) notFound()
  return { supabase, user }
})
