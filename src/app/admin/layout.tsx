import { notFound, redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AdminNav from './AdminNav'
import './admin.css'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  // Ask the database, never the browser, whether this person is an admin
  const { data: isAdmin } = await supabase.rpc('is_admin')
  // notFound() shows a normal 404, so outsiders can't even tell /admin exists
  if (!isAdmin) notFound()

  return (
    <div className="ad-shell">

      <header className="ad-top">
        <div className="ad-brand">
          <ShieldCheck size={18} aria-hidden /> CampusMart Admin
        </div>
        <AdminNav />
      </header>
      <div className="ad-body">{children}</div>
    </div>
  )
}
