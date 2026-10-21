import { notFound, redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AdminNav from './AdminNav'

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
      <style>{css}</style>
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

const css = `
.ad-shell{min-height:100vh;background:#070d1f;color:#e6ecff;font-family:'DM Sans',sans-serif}
.ad-top{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:14px 20px;background:#0b1530;border-bottom:1px solid #1e3a5f}
.ad-brand{display:flex;align-items:center;gap:8px;font-family:'Sora',sans-serif;font-weight:700;font-size:.95rem;color:#fff}
.ad-brand svg{color:#7fb0ff}
.ad-body{max-width:960px;margin:0 auto;padding:28px 20px 96px}
@media(max-width:480px){.ad-top{padding:12px 16px}.ad-body{padding:20px 14px 96px}}
`