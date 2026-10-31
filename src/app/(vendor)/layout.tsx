'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { vendorPageTitle } from '@/lib/vendor/navigation'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { LayoutDashboard, Package, ShoppingBag, Wallet, Settings, Store, MessageCircle, LogOut, HelpCircle, Menu, X, ArrowUpRight, ShieldCheck, Plus, ShoppingBasket, BookOpen } from 'lucide-react'
import './vendor.css'

const navItems = [
  { label: 'Overview', href: '/vendor/dashboard', icon: LayoutDashboard },
  { label: 'Listings', href: '/vendor/listings', icon: Package },
  { label: 'Orders', href: '/vendor/orders', icon: ShoppingBag },
  { label: 'Messages', href: '/vendor/messages', icon: MessageCircle },
  { label: 'Earnings', href: '/vendor/earnings', icon: Wallet },
]
const storeItems = [
  { label: 'Store settings', href: '/vendor/settings', icon: Settings },
  { label: 'Verification', href: '/vendor/verify', icon: ShieldCheck },
  { label: 'Vendor guide', href: '/vendor/guide', icon: BookOpen },
]

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarPath, setSidebarPath] = useState<string | null>(null)
  const sidebarOpen = sidebarPath === pathname
  const [vendorName, setVendorName] = useState('Your store')
  const [sellerId, setSellerId] = useState<string | null>(null)
  const [todoCount, setTodoCount] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: seller, error } = await supabase.from('sellers').select('id, store_name').eq('user_id', user.id).maybeSingle()
      if (cancelled) return
      if (error) { setLoadError(true); return }
      setLoadError(false)
      if (!seller) {
        if (pathname !== '/vendor/onboarding') router.replace('/vendor/onboarding')
        return
      }
      setSellerId(seller.id)
      setVendorName(seller.store_name || 'Your store')
      const { count } = await supabase.from('order_items')
        .select('id, orders!inner(payment_status)', { count: 'exact', head: true })
        .eq('seller_id', seller.id).in('fulfillment_status', ['pending', 'confirmed', 'shipped']).eq('orders.payment_status', 'paid')
      if (!cancelled) setTodoCount(count ?? 0)
    }
    load().catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [pathname, router])

  useEffect(() => {
    if (!sidebarOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = requestAnimationFrame(() => closeRef.current?.focus())
    function keydown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setSidebarPath(null); requestAnimationFrame(() => menuRef.current?.focus()) }
      if (e.key !== 'Tab') return
      const nodes = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')
      if (!nodes?.length) return
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    const media = window.matchMedia('(min-width: 901px)')
    const resize = () => { if (media.matches) setSidebarPath(null) }
    media.addEventListener('change', resize)
    return () => { cancelAnimationFrame(focusFrame); document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); media.removeEventListener('change', resize) }
  }, [sidebarOpen])

  async function signOut() {
    setSigningOut(true)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) { setLoadError(true); return }
      router.push('/login'); router.refresh()
    } catch { setLoadError(true) }
    finally { setSigningOut(false) }
  }

  const storeHref = sellerId ? `/vendors/${sellerId}` : null
  const initials = vendorName.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  const onboarding = pathname === '/vendor/onboarding'
  function links(items: typeof navItems) {
    return items.map(({ label, href, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(href + '/')
      return <Link key={href} href={href} onClick={() => setSidebarPath(null)} className={`vs-nav-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
        <Icon size={19} aria-hidden /> <span>{label}</span>{href === '/vendor/orders' && todoCount > 0 && <span className="vs-badge">{todoCount}</span>}
      </Link>
    })
  }
  return <div className={`vs-shell${onboarding ? ' vs-onboarding' : ''}`}>
    <a href="#vendor-content" className="vs-skip">Skip to content</a>
    {sidebarOpen && <button className="vs-overlay" tabIndex={-1} aria-label="Dismiss navigation" onClick={() => { setSidebarPath(null); requestAnimationFrame(() => menuRef.current?.focus()) }} />}
    <aside id="vendor-navigation" ref={sidebarRef} className={`vs-sidebar${sidebarOpen ? ' open' : ''}`} onTransitionEnd={event => { if (sidebarOpen && event.target === event.currentTarget && event.propertyName === 'transform') closeRef.current?.focus({ preventScroll: true }) }} role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen || undefined} aria-label="Vendor workspace">
      <div className="vs-logo-area"><Link href="/vendor/dashboard" className="vs-logo"><span className="vs-logo-icon"><ShoppingBasket size={21} /></span><span>Campus<span className="vs-brand-blue">Mart</span><small>VENDOR WORKSPACE</small></span></Link><button ref={closeRef} className="vs-close-btn" onClick={() => { setSidebarPath(null); requestAnimationFrame(() => menuRef.current?.focus()) }} aria-label="Close menu"><X size={20} /></button></div>
      <div className="vs-store-card"><span className="vs-store-initials">{initials}</span><div><strong>{vendorName}</strong><span>Your campus business</span></div></div>
      <nav className="vs-nav" aria-label="Vendor navigation"><p className="vs-nav-label">Manage</p>{links(navItems)}<p className="vs-nav-label vs-nav-label-spaced">Your store</p>{links(storeItems)}</nav>
      <div className="vs-bottom">
        <Link href={storeHref ?? '/start-selling'} className="vs-bottom-link"><Store size={18} />{storeHref ? 'My Store' : 'Set up store'}<ArrowUpRight size={14} className="vs-push" /></Link>
        <Link href="/" className="vs-bottom-link"><ShoppingBasket size={18} />Back to shopping</Link>
        <Link href="/contact" className="vs-bottom-link"><HelpCircle size={18} />Help &amp; support</Link>
        <button className="vs-bottom-link" onClick={signOut} disabled={signingOut}><LogOut size={18} />{signingOut ? 'Signing out…' : 'Log out'}</button>
      </div>
    </aside>
    <div className="vs-main" inert={sidebarOpen || undefined}>
      <header className="vs-topbar"><div className="vs-topbar-left"><button ref={menuRef} className="vs-hamburger" onClick={() => setSidebarPath(pathname)} aria-label="Open menu" aria-expanded={sidebarOpen} aria-controls="vendor-navigation"><Menu size={22} /></button><span className="vs-topbar-context">Workspace <span>/</span></span><p className="vs-topbar-title">{vendorPageTitle(pathname)}</p></div><div className="vs-topbar-right">{storeHref && <Link className="vs-store-link" href={storeHref}>View Store <ArrowUpRight size={15} /></Link>}<ThemeToggle /><Link href="/vendor/settings" className="vs-avatar" aria-label="Store settings">{initials}</Link></div></header>
      <main id="vendor-content" className="vs-content" tabIndex={-1}>{loadError && <p className="vx-notice" role="alert">We couldn’t complete that request. Please refresh and try again.</p>}{children}</main>
      {!onboarding && <nav className="vs-mobile-nav" aria-label="Quick navigation"><Link href="/vendor/dashboard" aria-current={pathname === '/vendor/dashboard' ? 'page' : undefined}><LayoutDashboard size={20} />Overview</Link><Link href="/vendor/listings" aria-current={pathname.startsWith('/vendor/listings') ? 'page' : undefined}><Package size={20} />Listings</Link><Link href="/vendor/listings/new" className="vs-mobile-add" aria-label="Create listing"><Plus size={23} /></Link><Link href="/vendor/orders" aria-current={pathname.startsWith('/vendor/orders') ? 'page' : undefined}><ShoppingBag size={20} />Orders</Link><Link href="/vendor/messages" aria-current={pathname.startsWith('/vendor/messages') ? 'page' : undefined}><MessageCircle size={20} />Messages</Link></nav>}
    </div>
  </div>
}
