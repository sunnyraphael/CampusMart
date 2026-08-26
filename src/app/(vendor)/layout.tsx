'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, ShoppingBag, DollarSign,
  CreditCard, Users, Star, Settings, Store, LogOut,
  HelpCircle, Menu, X,
} from 'lucide-react'

const navItems = [
  { label: 'Overview',       href: '/vendor/dashboard', icon: LayoutDashboard },
  { label: 'Products',       href: '/vendor/listings',  icon: Package },
  { label: 'Orders',         href: '/vendor/orders',    icon: ShoppingBag, badge: 12 },
  { label: 'Earnings',       href: '/vendor/earnings',  icon: DollarSign },
  { label: 'Payouts',        href: '/vendor/payouts',   icon: CreditCard },
  { label: 'Customers',      href: '/vendor/customers', icon: Users },
  { label: 'Reviews',        href: '/vendor/reviews',   icon: Star },
  { label: 'Store Settings', href: '/vendor/settings',  icon: Settings },
]

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [vendorInitials, setVendorInitials] = useState('--')

  // Auth — load vendor name from session
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const fullName =
        user.user_metadata?.full_name ??
        user.email?.split('@')[0] ??
        'Vendor'
      setVendorName(fullName)
      const parts = fullName.trim().split(' ')
      const initials =
        parts.length >= 2
          ? parts[0][0] + parts[1][0]
          : parts[0].slice(0, 2)
      setVendorInitials(initials.toUpperCase())
    })
  }, [])

  // ✅ FIXED: This useEffect was previously OUTSIDE the component (after the closing brace)
  // It must be INSIDE the function body — moved here where it belongs
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: seller } = await supabase
        .from('sellers')
        .select('store_name')
        .eq('user_id', user.id)
        .single()

      if (!seller?.store_name) {
        router.push('/vendor/onboarding')
      }
    })
  }, [])

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Lock body scroll when mobile sidebar is open
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
          transition: all 0.15s; position: relative;
        }
        .vs-nav-link:hover { background: rgba(37,99,235,0.08); color: #cbd5e1; }
        .vs-nav-link.active { background: #2563eb; color: #fff; font-weight: 600; }
        .vs-badge {
          margin-left: auto; background: #ef4444; color: white;
          font-size: 0.6rem; font-weight: 700; padding: 1px 5px; border-radius: 99px;
        }
        .vs-nav-link.active .vs-badge { background: rgba(255,255,255,0.3); }

        .vs-boost {
          margin: 12px 8px; background: linear-gradient(135deg,#1e40af,#2563eb);
          border-radius: 10px; padding: 14px;
        }
        .vs-boost h4 { font-family: var(--font-sora); font-size: 0.8rem; font-weight: 700; color: #fff; margin: 0 0 4px; }
        .vs-boost p { font-family: var(--font-dm-sans); font-size: 0.72rem; color: rgba(255,255,255,.8); margin: 0 0 10px; line-height: 1.4; }
        .vs-boost-btn {
          background: white; color: #1e40af; border: none; border-radius: 6px;
          padding: 6px 12px; font-family: var(--font-dm-sans); font-size: 0.75rem;
          font-weight: 600; cursor: pointer; width: 100%; text-align: center;
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
          transition: all 0.15s;
        }
        .vs-bottom-link:hover { color: #cbd5e1; background: rgba(37,99,235,0.08); }
        .vs-bottom-link.danger { color: #ef4444; }
        .vs-bottom-link.danger:hover { background: rgba(239,68,68,0.08); }

        .vs-main { margin-left: 220px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }

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
        }
        .vs-notif-btn:hover { background: rgba(37,99,235,0.08); }
        .vs-notif-dot {
          position: absolute; top: 3px; right: 3px;
          width: 15px; height: 15px; background: #ef4444; border-radius: 50%;
          font-size: 0.55rem; color: white; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .vs-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: #2563eb; color: white; font-weight: 700;
          font-size: 0.8rem; font-family: var(--font-sora);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .vs-avatar-info { text-align: right; }
        .vs-avatar-info .name { font-family: var(--font-sora); font-size: 0.8rem; font-weight: 600; color: var(--vs-heading, #fff); }
        .vs-avatar-info .sub { font-family: var(--font-dm-sans); font-size: 0.7rem; color: #2563eb; text-decoration: none; display: block; }

        .vs-content { flex: 1; padding: 20px; overflow-y: auto; }

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
        html.light .vs-nav-link:hover, html[data-theme="light"] .vs-nav-link:hover { background: #f1f5f9; color: #1e293b; }
        html.light .vs-bottom, html[data-theme="light"] .vs-bottom { border-top-color: #e2e8f0; }
        html.light .vs-bottom-link, html[data-theme="light"] .vs-bottom-link { color: #94a3b8; }
        html.light .vs-bottom-link:hover, html[data-theme="light"] .vs-bottom-link:hover { background: #f1f5f9; color: #1e293b; }
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
                <div className="vs-label">Seller Dashboard</div>
              </div>
            </Link>
            <button className="vs-close-btn" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <nav className="vs-nav">
            {navItems.map(({ label, href, icon: Icon, badge }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} className={`vs-nav-link${active ? ' active' : ''}`}>
                  <Icon size={17} />
                  {label}
                  {badge && <span className="vs-badge">{badge}</span>}
                </Link>
              )
            })}
          </nav>

          <div className="vs-boost">
            <h4>Grow your sales</h4>
            <p>Boost your products and get more visibility on CampusMart.</p>
            <button className="vs-boost-btn">↑ Boost Products</button>
          </div>

          <div className="vs-bottom">
            <Link href="/" className="vs-bottom-link">
              <Store size={16} /> My Store
            </Link>
            <Link href="/help" className="vs-bottom-link">
              <HelpCircle size={16} /> Help & Support
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
              <button className="vs-notif-btn" aria-label="Notifications">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span className="vs-notif-dot">3</span>
              </button>

              <div className="vs-avatar-info">
                <span className="name">{firstName || '...'}</span>
                <Link href="/" className="sub">View Store ↗</Link>
              </div>
              <div className="vs-avatar">{vendorInitials}</div>
            </div>
          </header>

          <main className="vs-content">
            {children}
          </main>
        </div>

      </div>
    </>
  )
}