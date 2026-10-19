'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShoppingBag, Tag, Eye, TrendingUp, ChevronRight, CheckCircle2, Circle, Package } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// Full amount: ₦800,000
function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG')
}

// Short amount: ₦800k, ₦1.2M. Keeps one decimal at most and drops a trailing .0
function compact(n: number) {
  const abs = Math.abs(n)
  const trim = (x: number) => String(Math.round(x * 10) / 10)
  if (abs >= 1_000_000) return '₦' + trim(n / 1_000_000) + 'M'
  if (abs >= 1_000) return '₦' + trim(n / 1_000) + 'k'
  return '₦' + n.toLocaleString('en-NG')
}

function getHour() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const statusColors: Record<string, { bg: string; color: string }> = {
  delivered:  { bg: '#dcfce7', color: '#16a34a' },
  processing: { bg: '#dbeafe', color: '#2563eb' },
  shipped:    { bg: '#ede9fe', color: '#7c3aed' },
  pending:    { bg: '#fef9c3', color: '#ca8a04' },
  confirmed:  { bg: '#dbeafe', color: '#2563eb' },
  cancelled:  { bg: '#fee2e2', color: '#dc2626' },
  received:   { bg: '#dcfce7', color: '#16a34a' },
  disputed:   { bg: '#fee2e2', color: '#b42318' },
}

interface Props {
  stats: { totalSales: number; totalOrders: number; totalProductsSold: number; storeViews: number; paidOut: number; pending: number } | null
  recentOrders: any[]
  topProducts: any[]
  chartData: { date: string; sales: number }[]
  productCount: number
  vendorName: string
}

export default function VendorDashboardClient({ stats, recentOrders, topProducts, chartData, productCount, vendorName }: Props) {
  const firstName = vendorName.split(' ')[0]
  // When true, the Total Sales card shows exact amounts instead of short ones
  const [exact, setExact] = useState(false)

  const dynamicSteps = [
    { label: 'Store profile completed',  done: true },
    { label: 'Add payout details',       done: false },
    { label: 'Add at least 3 products',  done: productCount >= 3 },
    { label: 'Made your first sale',     done: (stats?.totalOrders ?? 0) > 0 },
    { label: 'Get your first 5 reviews', done: false },
  ]
  const completedSteps = dynamicSteps.filter(s => s.done).length

  const hasData = stats && stats.totalOrders > 0
  const money = exact ? fmt : compact

  const cards = [
    {
      label: 'Total Sales',
      value: money(stats?.totalSales ?? 0),
      sub: hasData ? `${money(stats?.paidOut ?? 0)} paid out · ${money(stats?.pending ?? 0)} pending` : 'No sales yet',
      icon: <ShoppingBag size={18} />, live: !!hasData, tappable: true,
    },
    { label: 'Total Orders',  value: String(stats?.totalOrders ?? 0),       sub: hasData ? 'All products' : 'No orders yet',     icon: <Tag size={18} />,        live: !!hasData,        tappable: false },
    { label: 'Units Sold',    value: String(stats?.totalProductsSold ?? 0), sub: hasData ? 'Total units' : 'None sold yet',      icon: <TrendingUp size={18} />, live: !!hasData,        tappable: false },
    { label: 'Your Listings', value: String(productCount),                  sub: productCount > 0 ? 'Active products' : 'Add products', icon: <Eye size={18} />, live: productCount > 0, tappable: false },
  ]

  return (
    <>
      <style>{`
        .vd-grid { display: grid; gap: 20px; }
        .vd-grid > * { min-width: 0; }

        /* Stat cards: 2 x 2 on phones and tablets, 4 across on wide screens */
        .vd-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }
        .vd-stat-card {
          background: var(--vendor-card-bg, #0f1a35);
          border: 1px solid var(--vendor-card-border, #1e3a5f);
          border-radius: 12px; padding: 14px;
          display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
          text-align: left; width: 100%; color: inherit;
        }
        .vd-stat-card.tappable { cursor: pointer; transition: border-color .15s, background .15s; }
        .vd-stat-card.tappable:hover { border-color: #2563eb; }
        .vd-stat-card.tappable:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
        .vd-stat-body { min-width: 0; }
        .vd-stat-label { font-family: var(--font-dm-sans); font-size: 0.75rem; color: var(--vendor-muted, #64748b); margin: 0 0 4px; }
        .vd-stat-value { font-family: var(--font-sora); font-size: clamp(1.15rem, 4.6vw, 1.5rem); font-weight: 700; color: var(--vendor-heading, #fff); margin: 0 0 4px; overflow-wrap: anywhere; }
        .vd-stat-change { font-family: var(--font-dm-sans); font-size: 0.7rem; color: #22c55e; margin: 0; line-height: 1.35; }
        .vd-stat-change.neutral { color: var(--vendor-muted, #64748b); }
        .vd-stat-hint { font-family: var(--font-dm-sans); font-size: 0.65rem; color: var(--vendor-muted, #64748b); margin: 4px 0 0; }
        .vd-stat-icon { width: 34px; height: 34px; border-radius: 9px; background: rgba(37,99,235,0.12); display: flex; align-items: center; justify-content: center; color: #2563eb; flex-shrink: 0; }

        .vd-main-grid { grid-template-columns: minmax(0, 1fr) 360px; }
        .vd-card { background: var(--vendor-card-bg, #0f1a35); border: 1px solid var(--vendor-card-border, #1e3a5f); border-radius: 14px; padding: 22px; }
        .vd-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; gap: 8px; }
        .vd-card-title { font-family: var(--font-sora); font-size: 0.95rem; font-weight: 600; color: var(--vendor-heading, #fff); margin: 0; }
        .vd-view-all { font-family: var(--font-dm-sans); font-size: 0.8rem; color: #2563eb; text-decoration: none; white-space: nowrap; }
        .vd-view-all:hover { text-decoration: underline; }

        .vd-order-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--vendor-card-border, #1e3a5f); text-decoration: none; color: inherit; }
        .vd-order-row:last-child { border-bottom: none; }
        .vd-order-img { width: 44px; height: 44px; border-radius: 8px; flex-shrink: 0; background: #1e3a5f; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .vd-order-img img { width: 44px; height: 44px; object-fit: cover; }
        .vd-order-info { flex: 1; min-width: 0; }
        .vd-order-id { font-family: var(--font-sora); font-size: 0.82rem; font-weight: 600; color: var(--vendor-heading, #fff); }
        .vd-order-name { font-family: var(--font-dm-sans); font-size: 0.78rem; color: var(--vendor-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vd-status-badge { font-size: 0.7rem; font-family: var(--font-dm-sans); font-weight: 600; padding: 3px 9px; border-radius: 99px; white-space: nowrap; text-transform: capitalize; }
        .vd-order-amount { font-family: var(--font-sora); font-size: 0.82rem; font-weight: 600; color: var(--vendor-heading, #fff); white-space: nowrap; }

        .vd-product-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--vendor-card-border, #1e3a5f); }
        .vd-product-row:last-child { border-bottom: none; }
        .vd-product-img { width: 40px; height: 40px; border-radius: 8px; flex-shrink: 0; background: #1e3a5f; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .vd-product-img img { width: 40px; height: 40px; object-fit: cover; }
        .vd-product-name { font-family: var(--font-dm-sans); font-size: 0.85rem; color: var(--vendor-heading, #fff); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vd-product-sold { font-family: var(--font-dm-sans); font-size: 0.78rem; color: var(--vendor-muted, #64748b); width: 48px; text-align: center; }
        .vd-product-rev { font-family: var(--font-sora); font-size: 0.85rem; font-weight: 600; color: var(--vendor-heading, #fff); text-align: right; white-space: nowrap; }
        .vd-th { font-family: var(--font-dm-sans); font-size: 0.72rem; color: var(--vendor-muted, #64748b); text-transform: uppercase; letter-spacing: 0.05em; }

        .vd-setup-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
        .vd-setup-label { font-family: var(--font-dm-sans); font-size: 0.85rem; color: var(--vendor-heading, #fff); }
        .vd-setup-label.done { color: var(--vendor-muted, #64748b); text-decoration: line-through; }

        .vd-tips-card { background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); border-radius: 12px; padding: 20px; margin-top: 16px; }
        .vd-tips-card h3 { font-family: var(--font-sora); font-size: 0.95rem; font-weight: 700; color: white; margin: 0 0 6px; }
        .vd-tips-card p { font-family: var(--font-dm-sans); font-size: 0.78rem; color: rgba(255,255,255,0.8); margin: 0 0 14px; line-height: 1.5; }
        .vd-tips-btn { background: white; color: #1e40af; border: none; border-radius: 8px; padding: 8px 16px; font-family: var(--font-dm-sans); font-size: 0.8rem; font-weight: 600; cursor: pointer; }

        .vd-empty { text-align: center; padding: 32px 16px; color: var(--vendor-muted, #64748b); font-family: var(--font-dm-sans); font-size: 0.85rem; }

        /* Light mode */
        html.light .vd-stat-card, html[data-theme="light"] .vd-stat-card,
        html.light .vd-card, html[data-theme="light"] .vd-card { background: #ffffff; border-color: #e2e8f0; }
        html.light .vd-stat-label, html[data-theme="light"] .vd-stat-label,
        html.light .vd-stat-hint, html[data-theme="light"] .vd-stat-hint,
        html.light .vd-order-name, html[data-theme="light"] .vd-order-name,
        html.light .vd-product-sold, html[data-theme="light"] .vd-product-sold,
        html.light .vd-th, html[data-theme="light"] .vd-th,
        html.light .vd-empty, html[data-theme="light"] .vd-empty { color: #94a3b8; }
        html.light .vd-stat-value, html[data-theme="light"] .vd-stat-value,
        html.light .vd-card-title, html[data-theme="light"] .vd-card-title,
        html.light .vd-order-id, html[data-theme="light"] .vd-order-id,
        html.light .vd-order-amount, html[data-theme="light"] .vd-order-amount,
        html.light .vd-product-name, html[data-theme="light"] .vd-product-name,
        html.light .vd-product-rev, html[data-theme="light"] .vd-product-rev,
        html.light .vd-setup-label, html[data-theme="light"] .vd-setup-label { color: #0f172a; }
        html.light .vd-order-row, html[data-theme="light"] .vd-order-row,
        html.light .vd-product-row, html[data-theme="light"] .vd-product-row { border-color: #f1f5f9; }
        html.light .vd-order-img, html[data-theme="light"] .vd-order-img,
        html.light .vd-product-img, html[data-theme="light"] .vd-product-img { background: #f1f5f9; }

        @media (min-width: 1100px) { .vd-stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; } }
        @media (max-width: 900px) { .vd-main-grid { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 520px) {
          .vd-card { padding: 16px; }
          .vd-chev { display: none; }
          .vd-order-row { gap: 8px; }
        }
      `}</style>

      {/* Greeting */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 'clamp(1.1rem, 4.5vw, 1.3rem)', fontWeight: 700, color: 'var(--vendor-heading, #fff)', margin: '0 0 4px' }}>
          Good {getHour()}, {firstName}
        </h2>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '0.85rem', color: 'var(--vendor-muted, #64748b)', margin: 0 }}>
          {hasData ? "Here's what's happening with your store." : "Your store is set up. Start adding products to make your first sale!"}
        </p>
      </div>

      {/* Stat cards */}
      <div className="vd-grid vd-stat-grid">
        {cards.map((s) => (
          <div
            key={s.label}
            className={`vd-stat-card${s.tappable ? ' tappable' : ''}`}
            {...(s.tappable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-pressed': exact,
                  'aria-label': `${s.label}. ${exact ? 'Showing exact amounts' : 'Showing short amounts'}. Press to switch.`,
                  onClick: () => setExact((v) => !v),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExact((v) => !v)
                    }
                  },
                }
              : {})}
          >
            <div className="vd-stat-body">
              <p className="vd-stat-label">{s.label}</p>
              <p className="vd-stat-value">{s.value}</p>
              <p className={`vd-stat-change${s.live ? '' : ' neutral'}`}>{s.sub}</p>
              {s.tappable && hasData && (
                <p className="vd-stat-hint">{exact ? 'Tap for short view' : 'Tap for exact amount'}</p>
              )}
            </div>
            <div className="vd-stat-icon">{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Main two-column grid */}
      <div className="vd-grid vd-main-grid">

        {/* Left column */}
        <div className="vd-grid" style={{ gap: '20px' }}>

          {/* Sales chart */}
          <div className="vd-card">
            <div className="vd-card-header">
              <h2 className="vd-card-title">Sales Overview — Last 7 Days</h2>
            </div>
            {hasData ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'var(--font-dm-sans)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'var(--font-dm-sans)' }} axisLine={false} tickLine={false} tickFormatter={(v) => compact(Number(v))} />
                  <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), 'Sales']} contentStyle={{ background: '#0f1a35', border: '1px solid #1e3a5f', borderRadius: 8, fontFamily: 'var(--font-dm-sans)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="vd-empty" style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <TrendingUp size={32} color="#1e3a5f" />
                <p style={{ margin: 0 }}>Sales data will appear here once you receive orders.</p>
              </div>
            )}
          </div>

          {/* Best selling products */}
          <div className="vd-card">
            <div className="vd-card-header">
              <h2 className="vd-card-title">Best Selling Products</h2>
              <Link href="/vendor/listings" className="vd-view-all">View all</Link>
            </div>
            {topProducts.length === 0 ? (
              <div className="vd-empty">No sales recorded yet. Your top products will appear here.</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, paddingBottom: 8, borderBottom: '1px solid var(--vendor-card-border, #1e3a5f)', marginBottom: 4 }}>
                  <div style={{ width: 40 }} />
                  <span className="vd-th" style={{ flex: 1 }}>Product</span>
                  <span className="vd-th" style={{ width: 48, textAlign: 'center' }}>Sold</span>
                  <span className="vd-th" style={{ textAlign: 'right' }}>Revenue</span>
                </div>
                {topProducts.map((p) => (
                  <div key={p.name} className="vd-product-row">
                    <div className="vd-product-img">
                      {p.image ? <img src={p.image} alt={p.name} /> : <Package size={18} color="#64748b" />}
                    </div>
                    <span className="vd-product-name">{p.name}</span>
                    <span className="vd-product-sold">{p.sold}</span>
                    <span className="vd-product-rev">{compact(p.revenue)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="vd-grid" style={{ gap: '20px' }}>

          {/* Recent orders */}
          <div className="vd-card">
            <div className="vd-card-header">
              <h2 className="vd-card-title">Recent Orders</h2>
              <Link href="/vendor/orders" className="vd-view-all">View all</Link>
            </div>
            {recentOrders.length === 0 ? (
              <div className="vd-empty">No orders yet. When buyers purchase your products, they'll show up here.</div>
            ) : (
              recentOrders.map((o) => {
                const s = statusColors[o.status] ?? { bg: '#f1f5f9', color: '#64748b' }
                return (
                  <Link key={o.id} href={`/vendor/orders/${o.id}`} className="vd-order-row">
                    <div className="vd-order-img">
                      {o.productImage ? <img src={o.productImage} alt={o.productName} /> : <Package size={18} color="#64748b" />}
                    </div>
                    <div className="vd-order-info">
                      <div className="vd-order-id">#{o.shortId}</div>
                      <div className="vd-order-name">{o.productName}</div>
                    </div>
                    <span className="vd-status-badge" style={{ background: s.bg, color: s.color }}>{o.status}</span>
                    <span className="vd-order-amount">{compact(o.amount)}</span>
                    <ChevronRight size={15} color="#64748b" className="vd-chev" />
                  </Link>
                )
              })
            )}
          </div>

          {/* Store setup progress */}
          <div className="vd-card">
            <div className="vd-card-header">
              <h2 className="vd-card-title">Store Setup Progress</h2>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '0.78rem', color: '#22c55e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {completedSteps}/{dynamicSteps.length} done
              </span>
            </div>
            {dynamicSteps.map((s) => (
              <div key={s.label} className="vd-setup-row">
                {s.done ? <CheckCircle2 size={18} color="#22c55e" /> : <Circle size={18} color="#64748b" />}
                <span className={`vd-setup-label${s.done ? ' done' : ''}`}>{s.label}</span>
              </div>
            ))}

            <div className="vd-tips-card">
              <h3>Tips to grow your store</h3>
              <p>List high-quality products, keep your prices competitive and respond to buyers fast.</p>
              <Link href="/vendor/settings">
                <button className="vd-tips-btn">View Tips →</button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}