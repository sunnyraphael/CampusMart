'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, ShoppingBag, DollarSign,
  Settings, Store, LogOut, HelpCircle, Menu, X, Bell, ArrowUpRight,
} from 'lucide-react'

// To add a page later (Customers, Reviews), build its page.tsx first,
// then add one line here. Never link to a page that does not exist yet.
const navItems = [
  { label: 'Overview',       href: '/vendor/dashboard', icon: LayoutDashboard },
  { label: 'Products',       href: '/vendor/listings',  icon: Package },
  { label: 'Orders',         href: '/vendor/orders',    icon: ShoppingBag, badge: 'todo' },
  { label: 'Earnings',       href: '/vendor/earnings',  icon: DollarSign },
  { label: 'Store Settings', href: '/vendor/settings',  icon: Settings },
]

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [vendorInitials, setVendorInitials] = useState('--')
  const [sellerId, setSellerId] = useState<string | null>(null)
  const [todoCount, setTodoCount] = useState(0)

  // One effect loads the user, their name and their vendor row together.
  // It re-tries on navigation only while sellerId is still empty, so a vendor
  // who just finished onboarding gets their badge without a page refresh.
  useEffect(() => {
    if (sellerId) return
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const fullName =
        user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Vendor'
      setVendorName(fullName)
      const parts = fullName.trim().split(' ')
      const initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
      setVendorInitials(initials.toUpperCase())

      const { data: seller } = await supabase
        .from('sellers')
        .select('id, store_name')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return

      if (!seller?.store_name) {
        if (pathname !== '/vendor/onboarding') router.push('/vendor/onboarding')
        return
      }
      setSellerId(seller.id)
    }

    load()
    return () => { cancelled = true }
  }, [pathname, sellerId, router])

  // Count items that need the vendor's action. Re-runs on every page change.
  useEffect(() => {
    if (!sellerId) return
    const supabase = createClient()
    supabase
      .from('order_items')
      .select('id, orders!inner(payment_status)', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .in('fulfillment_status', ['pending', 'confirmed', 'shipped'])
      .eq('orders.payment_status', 'paid')
      .then(({ count }) => setTodoCount(count ?? 0))
  }, [pathname, sellerId])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const firstName = vendorName.split(' ')[0]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .vs-shell { display: flex; min-height: 100vh; background: var(--page-bg); position: relative; }

        .vs-overlay {
          display: none;
          position: fixed; inset: 0; background: rgba(0,0,0,0.55);
          z-index: 49; backdrop-filter: blur(2px);
        }
        .vs-overlay.open { display: block; }

        .vs-sidebar {
          width: 220px; flex-shrink: 0;
          background: var(--vs-bg, #0f1a35);
          border-right: 1px solid var(--vs-border, #1e3a5f);
          display: flex; flex-direction: column;
          padding: 20px 0;
          position: fixed; top: 0; left: 0; bottom: 0;
          z-index: 50;
          transition: transform 0.28s cubic-bezier(.4,0,.2,1);
        }

        .vs-logo-area {
          padding: 0 16px 20px;
          border-bottom: 1px solid var(--vs-border, #1e3a5f);
          margin-bottom: 12px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .vs-logo {
          font-family: var(--font-sora); font-weight: 700; font-size: 1rem;
          color: #2563eb; text-decoration: none;
          display: flex; align-items: center; gap: 8px;
        }
        .vs-logo-icon {
          width: 28px; height: 28px; background: #2563eb; border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;
        }
        .vs-label {
          font-family: var(--font-dm-sans); font-size: 0.65rem;
          color: var(--vs-muted, #64748b); margin-top: 3px;
          letter-spacing: 0.08em; text-transform: uppercase;
        }
        .vs-close-btn {
          display: none; background: none; border: none; cursor: pointer;
          color: var(--vs-muted, #64748b); padding: 4px;
        }

        .vs-nav { flex: 1; padding: 0 8px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
        .vs-nav-link {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 8px; text-decoration: none;
          font-family: var(--font-dm-sans); font-size: 0.85rem;
          color: var(--vs-nav-color, #94a3b8);
          transition: background 0.15s, color 0.15s; position: relative;
        }
        .vs-nav-link:hover { background: rgba(37,99,235,0.08); color: #cbd5e1; }
        .vs-nav-link.active { background: #2563eb; color: #fff; font-weight: 600; }
        .vs-badge {
          margin-left: auto; background: #ef4444; color: white;
          font-size: 0.6rem; font-weight: 700; padding: 1px 5px; border-radius: 99px;
        }
        .vs-nav-link.active .vs-badge { background: rgba(255,255,255,0.3); }

        .vs-nav-link:focus-visible, .vs-bottom-link:focus-visible,
        .vs-hamburger:focus-visible, .vs-notif-btn:focus-visible, .vs-close-btn:focus-visible {
          outline: 2px solid #2563eb; outline-offset: 2px;
        }

        .vs-bottom {
          padding: 12px 8px 0;
          border-top: 1px solid var(--vs-border, #1e3a5f);
          display: flex; flex-direction: column; gap: 2px;
        }
        .vs-bottom-link {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 8px; text-decoration: none;
          font-family: var(--font-dm-sans); font-size: 0.82rem;
          color: var(--vs-muted, #64748b);
          background: none; border: none; cursor: pointer; width: 100%;
          transition: background 0.15s, color 0.15s;
        }
        .vs-bottom-link:hover { color: #cbd5e1; background: rgba(37,99,235,0.08); }
        .vs-bottom-link.danger { color: #ef4444; }
        .vs-bottom-link.danger:hover { background: rgba(239,68,68,0.08); }

        .vs-main { margin-left: 220px; flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 100vh; }

        .vs-topbar {
          height: 56px;
          background: var(--vs-topbar-bg, var(--navbar-bg, #0f1a35));
          border-bottom: 1px solid var(--vs-border, #1e3a5f);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px; position: sticky; top: 0; z-index: 30;
        }
        .vs-hamburger {
          display: none;
          background: none; border: none; cursor: pointer;
          color: var(--vs-muted, #94a3b8); padding: 6px; border-radius: 8px;
        }
        .vs-hamburger:hover { background: rgba(37,99,235,0.08); }
        .vs-topbar-title {
          font-family: var(--font-sora); font-size: 0.95rem; font-weight: 700;
          color: var(--vs-heading, #fff); margin: 0;
        }
        .vs-topbar-right { display: flex; align-items: center; gap: 10px; }
        .vs-notif-btn {
          position: relative; background: none; border: none; cursor: pointer;
          color: var(--vs-muted, #94a3b8); padding: 6px; border-radius: 8px;
          display: flex; align-items: center;
        }
        .vs-notif-btn:hover { background: rgba(37,99,235,0.08); }
        .vs-notif-dot {
          position: absolute; top: 1px; right: 1px;
          min-width: 15px; height: 15px; padding: 0 3px; background: #ef4444; border-radius: 99px;
          font-size: 0.55rem; color: white; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .vs-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: #2563eb; color: white; font-weight: 700;
          font-size: 0.8rem; font-family: var(--font-sora);
          display: flex; align-items: center; justify-content: center;
        }
        .vs-avatar-info { text-align: right; }
        .vs-avatar-info .name { font-family: var(--font-sora); font-size: 0.8rem; font-weight: 600; color: var(--vs-heading, #fff); display: block; }
        .vs-avatar-info .sub {
          font-family: var(--font-dm-sans); font-size: 0.7rem; color: #2563eb;
          text-decoration: none; display: inline-flex; align-items: center; gap: 2px;
        }

        .vs-content { flex: 1; min-width: 0; padding: 20px; overflow-y: auto; }

        @media (max-width: 768px) {
          .vs-sidebar { transform: translateX(-100%); }
          .vs-sidebar.open { transform: translateX(0); }
          .vs-close-btn { display: flex; }
          .vs-main { margin-left: 0; }
          .vs-hamburger { display: flex; }
          .vs-avatar-info { display: none; }
          .vs-content { padding: 14px; }
          .vs-topbar { height: 52px; padding: 0 14px; }
        }

        html.light .vs-sidebar, html[data-theme="light"] .vs-sidebar { background: #ffffff; border-right-color: #e2e8f0; }
        html.light .vs-logo-area, html[data-theme="light"] .vs-logo-area { border-bottom-color: #e2e8f0; }
        html.light .vs-nav-link, html[data-theme="light"] .vs-nav-link { color: #64748b; }
        html.light .vs-nav-link.active, html[data-theme="light"] .vs-nav-link.active { background: #2563eb; color: #fff; }
        html.light .vs-nav-link:hover, html[data-theme="light"] .vs-nav-link:hover { background: #f1f5f9; color: #1e293b; }
        html.light .vs-nav-link.active:hover, html[data-theme="light"] .vs-nav-link.active:hover { background: #2563eb; color: #fff; }
        html.light .vs-bottom, html[data-theme="light"] .vs-bottom { border-top-color: #e2e8f0; }
        html.light .vs-bottom-link, html[data-theme="light"] .vs-bottom-link { color: #94a3b8; }
        html.light .vs-bottom-link:hover, html[data-theme="light"] .vs-bottom-link:hover { background: #f1f5f9; color: #1e293b; }
        html.light .vs-bottom-link.danger, html[data-theme="light"] .vs-bottom-link.danger { color: #ef4444; }
        html.light .vs-label, html[data-theme="light"] .vs-label { color: #94a3b8; }
        html.light .vs-topbar, html[data-theme="light"] .vs-topbar { background: #ffffff; border-bottom-color: #e2e8f0; }
        html.light .vs-topbar-title, html[data-theme="light"] .vs-topbar-title { color: #0f172a; }
        html.light .vs-avatar-info .name, html[data-theme="light"] .vs-avatar-info .name { color: #0f172a; }
        html.light .vs-hamburger, html[data-theme="light"] .vs-hamburger { color: #64748b; }
        html.light .vs-notif-btn, html[data-theme="light"] .vs-notif-btn { color: #64748b; }
      `}</style>

      <div className="vs-shell">
        <div
          className={`vs-overlay${sidebarOpen ? ' open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside className={`vs-sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="vs-logo-area">
            <Link href="/" className="vs-logo">
              <div className="vs-logo-icon">C</div>
              <div>
                CampusMart
                <div className="vs-label">Vendor Dashboard</div>
              </div>
            </Link>
            <button className="vs-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
          </div>

          <nav className="vs-nav" aria-label="Vendor navigation">
            {navItems.map(({ label, href, icon: Icon, badge }) => {
              // startsWith keeps "Orders" lit up on /vendor/orders/123 too
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`vs-nav-link${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={17} />
                  {label}
                  {badge === 'todo' && todoCount > 0 && <span className="vs-badge">{todoCount}</span>}
                </Link>
              )
            })}
          </nav>

          <div className="vs-bottom">
            <Link href="/" className="vs-bottom-link">
              <Store size={16} /> My Store
            </Link>
            <Link href="/help" className="vs-bottom-link">
              <HelpCircle size={16} /> Help &amp; Support
            </Link>
            <button className="vs-bottom-link danger" onClick={handleSignOut}>
              <LogOut size={16} /> Log out
            </button>
          </div>
        </aside>

        <div className="vs-main">
          <header className="vs-topbar">
            <button className="vs-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>

            <p className="vs-topbar-title">Vendor Dashboard</p>

            <div className="vs-topbar-right">
              <button
                className="vs-notif-btn"
                aria-label={todoCount > 0 ? `${todoCount} orders need action` : 'Orders'}
                onClick={() => router.push('/vendor/orders')}
              >
                <Bell size={19} />
                {todoCount > 0 && <span className="vs-notif-dot">{todoCount}</span>}
              </button>

              <div className="vs-avatar-info">
                <span className="name">{firstName || '...'}</span>
                <Link href="/" className="sub">View Store <ArrowUpRight size={12} /></Link>
              </div>
              <div className="vs-avatar">{vendorInitials}</div>
            </div>
          </header>

          <main className="vs-content">{children}</main>
        </div>
      </div>
    </>
  )
}