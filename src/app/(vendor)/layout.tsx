'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  DollarSign,
  CreditCard,
  Users,
  Star,
  Settings,
  Store,
  LogOut,
  HelpCircle,
} from 'lucide-react'

const navItems = [
  { label: 'Overview',       href: '/vendor/dashboard',  icon: LayoutDashboard },
  { label: 'Products',       href: '/vendor/listings',   icon: Package },
  { label: 'Orders',         href: '/vendor/orders',     icon: ShoppingBag,  badge: 12 },
  { label: 'Earnings',       href: '/vendor/earnings',   icon: DollarSign },
  { label: 'Payouts',        href: '/vendor/payouts',    icon: CreditCard },
  { label: 'Customers',      href: '/vendor/customers',  icon: Users },
  { label: 'Reviews',        href: '/vendor/reviews',    icon: Star },
  { label: 'Store Settings', href: '/vendor/settings',   icon: Settings },
]

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <style>{`
        .vendor-shell {
          display: flex;
          min-height: 100vh;
          background: var(--page-bg);
        }
        .vendor-sidebar {
          width: 220px;
          flex-shrink: 0;
          background: var(--vendor-sidebar-bg, #0f1a35);
          border-right: 1px solid var(--vendor-sidebar-border, #1e3a5f);
          display: flex;
          flex-direction: column;
          padding: 24px 0;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 40;
        }
        .vendor-logo-area {
          padding: 0 20px 28px;
          border-bottom: 1px solid var(--vendor-sidebar-border, #1e3a5f);
          margin-bottom: 16px;
        }
        .vendor-logo {
          font-family: var(--font-sora);
          font-weight: 700;
          font-size: 1.1rem;
          color: #2563eb;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .vendor-logo-icon {
          width: 32px; height: 32px;
          background: #2563eb;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 800; font-size: 0.85rem;
        }
        .vendor-label {
          font-family: var(--font-dm-sans);
          font-size: 0.7rem;
          color: var(--vendor-muted, #64748b);
          margin-top: 4px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .vendor-nav { flex: 1; padding: 0 10px; display: flex; flex-direction: column; gap: 2px; }
        .vendor-nav-link {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 8px;
          text-decoration: none;
          font-family: var(--font-dm-sans);
          font-size: 0.875rem;
          color: var(--vendor-nav-color, #94a3b8);
          transition: all 0.15s;
          position: relative;
        }
        .vendor-nav-link:hover { background: var(--vendor-nav-hover, rgba(37,99,235,0.08)); color: var(--vendor-nav-hover-color, #cbd5e1); }
        .vendor-nav-link.active { background: #2563eb; color: #fff; font-weight: 600; }
        .vendor-nav-badge {
          margin-left: auto;
          background: #ef4444;
          color: white;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 99px;
        }
        .vendor-nav-link.active .vendor-nav-badge { background: rgba(255,255,255,0.3); }
        .vendor-sidebar-bottom { padding: 16px 10px 0; border-top: 1px solid var(--vendor-sidebar-border, #1e3a5f); display: flex; flex-direction: column; gap: 2px; }
        .vendor-bottom-link {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 8px;
          text-decoration: none;
          font-family: var(--font-dm-sans); font-size: 0.875rem;
          color: var(--vendor-muted, #64748b);
          transition: all 0.15s;
          background: none; border: none; cursor: pointer; width: 100%;
        }
        .vendor-bottom-link:hover { color: var(--vendor-nav-hover-color, #cbd5e1); background: var(--vendor-nav-hover, rgba(37,99,235,0.08)); }
        .vendor-bottom-link.danger { color: #ef4444; }
        .vendor-bottom-link.danger:hover { background: rgba(239,68,68,0.08); }

        /* Boost banner in sidebar */
        .vendor-boost-banner {
          margin: 16px 10px 0;
          background: linear-gradient(135deg, #1e40af, #2563eb);
          border-radius: 12px;
          padding: 16px;
          color: white;
        }
        .vendor-boost-banner h4 { font-family: var(--font-sora); font-size: 0.85rem; font-weight: 700; margin: 0 0 4px; }
        .vendor-boost-banner p { font-family: var(--font-dm-sans); font-size: 0.75rem; opacity: 0.85; margin: 0 0 12px; line-height: 1.4; }
        .vendor-boost-btn {
          display: flex; align-items: center; gap: 6px;
          background: white; color: #1e40af;
          border: none; border-radius: 6px; padding: 7px 12px;
          font-family: var(--font-dm-sans); font-size: 0.8rem; font-weight: 600;
          cursor: pointer; width: 100%; justify-content: center;
        }

        /* Main area */
        .vendor-main { margin-left: 220px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
        .vendor-topbar {
          height: 64px;
          background: var(--vendor-topbar-bg, var(--navbar-bg));
          border-bottom: 1px solid var(--vendor-sidebar-border, #1e3a5f);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px;
          position: sticky; top: 0; z-index: 30;
        }
        .vendor-topbar-left h1 {
          font-family: var(--font-sora); font-size: 1.1rem; font-weight: 700;
          color: var(--vendor-heading, #ffffff); margin: 0;
        }
        .vendor-topbar-left p {
          font-family: var(--font-dm-sans); font-size: 0.8rem;
          color: var(--vendor-muted, #64748b); margin: 0;
        }
        .vendor-topbar-right { display: flex; align-items: center; gap: 12px; }
        .vendor-notif-btn {
          position: relative; background: none; border: none; cursor: pointer;
          color: var(--vendor-muted, #64748b); padding: 6px;
          border-radius: 8px; transition: background 0.15s;
        }
        .vendor-notif-btn:hover { background: var(--vendor-nav-hover, rgba(37,99,235,0.08)); }
        .vendor-notif-dot {
          position: absolute; top: 4px; right: 4px;
          width: 16px; height: 16px; background: #ef4444;
          border-radius: 50%; font-size: 0.6rem; color: white;
          display: flex; align-items: center; justify-content: center; font-weight: 700;
        }
        .vendor-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: #2563eb; color: white; font-weight: 700;
          font-size: 0.85rem; font-family: var(--font-sora);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .vendor-avatar-info { text-align: right; }
        .vendor-avatar-info .name { font-family: var(--font-sora); font-size: 0.85rem; font-weight: 600; color: var(--vendor-heading, #fff); }
        .vendor-avatar-info .sub { font-family: var(--font-dm-sans); font-size: 0.72rem; color: #2563eb; cursor: pointer; text-decoration: none; }
        .vendor-content { flex: 1; padding: 28px; overflow-y: auto; }

        /* Light mode overrides */
        html.light .vendor-sidebar, html[data-theme="light"] .vendor-sidebar {
          background: #ffffff;
          border-right-color: #e2e8f0;
        }
        html.light .vendor-logo-area, html[data-theme="light"] .vendor-logo-area { border-bottom-color: #e2e8f0; }
        html.light .vendor-nav-link { color: #64748b; }
        html.light .vendor-nav-link:hover { background: #f1f5f9; color: #1e293b; }
        html.light .vendor-sidebar-bottom { border-top-color: #e2e8f0; }
        html.light .vendor-bottom-link { color: #94a3b8; }
        html.light .vendor-bottom-link:hover { background: #f1f5f9; color: #1e293b; }
        html.light .vendor-label { color: #94a3b8; }
        html.light .vendor-topbar { background: #ffffff; border-bottom-color: #e2e8f0; }
        html.light .vendor-topbar-left h1 { color: #0f172a; }
        html.light .vendor-topbar-left p { color: #64748b; }
        html.light .vendor-avatar-info .name { color: #0f172a; }
        html.light .vendor-notif-btn { color: #64748b; }
        html.light .vendor-notif-btn:hover { background: #f1f5f9; }
      `}</style>

      <div className="vendor-shell">
        {/* Sidebar */}
        <aside className="vendor-sidebar">
          <div className="vendor-logo-area">
            <Link href="/" className="vendor-logo">
              <div className="vendor-logo-icon">C</div>
              CampusMart
            </Link>
            <p className="vendor-label">Seller Dashboard</p>
          </div>

          <nav className="vendor-nav">
            {navItems.map(({ label, href, icon: Icon, badge }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} className={`vendor-nav-link${active ? ' active' : ''}`}>
                  <Icon size={17} />
                  {label}
                  {badge && <span className="vendor-nav-badge">{badge}</span>}
                </Link>
              )
            })}
          </nav>

          {/* Boost banner */}
          <div className="vendor-boost-banner">
            <h4>Grow your sales</h4>
            <p>Boost your products and get more visibility on CampusMart.</p>
            <button className="vendor-boost-btn">↑ Boost Products</button>
          </div>

          <div className="vendor-sidebar-bottom">
            <Link href="/" className="vendor-bottom-link">
              <Store size={17} />
              My Store
            </Link>
            <Link href="/help" className="vendor-bottom-link">
              <HelpCircle size={17} />
              Help & Support
            </Link>
            <button className="vendor-bottom-link danger">
              <LogOut size={17} />
              Log out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="vendor-main">
          <header className="vendor-topbar">
            <div className="vendor-topbar-left">
              <h1>Good morning, Folarin 👋</h1>
              <p>Here's what's happening with your store today.</p>
            </div>
            <div className="vendor-topbar-right">
              <button className="vendor-notif-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span className="vendor-notif-dot">3</span>
              </button>
              <div className="vendor-avatar-info">
                <div className="name">Folarin D.</div>
                <Link href="/" className="sub">View Store ↗</Link>
              </div>
              <div className="vendor-avatar">FD</div>
            </div>
          </header>

          <main className="vendor-content">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}