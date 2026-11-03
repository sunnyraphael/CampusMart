'use client'
import OperationsIndicator from '@/components/admin/OperationsIndicator'
import BrandMark from '@/components/BrandMark'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowUpRight, ChevronRight, LogOut, ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { createClient } from '@/lib/supabase/client'
import AdminNav, { adminSections } from './AdminNav'

export default function AdminWorkspace({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const section = adminSections.find(s => s.href === pathname)?.label ?? 'Overview'
  async function signOut() {
    if (busy) return
    setBusy(true); setError('')
    try {
      await createClient().rpc('cm_lock_admin')
      const { error } = await createClient().auth.signOut()
      if (error) { setError('Could not sign out. Please try again.'); return }
      router.push('/login'); router.refresh()
    } catch { setError('Check your connection and try again.') } finally { setBusy(false) }
  }
  return <div className="ad-shell">
    <a className="aw-skip" href="#admin-content">Skip to admin content</a>
    <aside className="aw-sidebar" aria-label="Admin workspace">
      <Link className="aw-brand" href="/admin"><BrandMark/><span>Campus<span className="aw-blue">Mart</span><small>ADMIN WORKSPACE</small></span></Link>
      <p className="aw-nav-label">Manage marketplace</p><AdminNav />
      <div className="aw-sidebar-foot"><div className="aw-access-note"><ShieldCheck size={18} aria-hidden /><span>Administrator access<small>Review decisions with care.</small></span></div><Link href="/" className="aw-back"><ArrowUpRight size={17} aria-hidden />Back to marketplace</Link><button className="aw-back" disabled={busy} onClick={signOut}><LogOut size={17} aria-hidden />{busy ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    <div className="aw-main"><header className="aw-topbar"><div className="aw-breadcrumb"><span>Workspace</span><ChevronRight size={14} aria-hidden /><strong>{section}</strong></div><div className="aw-top-actions"><Link href="/admin-security?pin=1" className="buyer-btn aw-security-link" aria-label="Password and PIN"><ShieldCheck size={16} aria-hidden/><span>Password &amp; PIN</span></Link><OperationsIndicator/><Link href="/" className="aw-market-link" aria-label="Back to marketplace"><span>Marketplace</span> <ArrowUpRight size={14} aria-hidden /></Link><ThemeToggle /><button className="aw-mobile-logout" aria-label="Sign out" disabled={busy} onClick={signOut}><LogOut size={18} aria-hidden /></button><span className="aw-avatar" title={name} aria-label={`Signed in as ${name}`}>{name.slice(0, 1).toUpperCase()}</span></div></header>
      <main id="admin-content" className="ad-body" tabIndex={-1}>{error && <p className="buyer-notice is-error" role="alert">{error}</p>}{children}</main>
    </div>
  </div>
}
