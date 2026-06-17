'use client'

import Link from 'next/link'
import { ShoppingBag, Tag, Eye, TrendingUp, ChevronRight, CheckCircle2, Circle, Package } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function fmt(n: number) {
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
}

const setupSteps = [
  { label: 'Store profile completed',  done: true },
  { label: 'Add payout details',       done: false },
  { label: 'Add at least 3 products',  done: false },
  { label: 'Get your first 5 reviews', done: false },
]

interface Props {
  stats: { totalSales: number; totalOrders: number; totalProductsSold: number; storeViews: number } | null
  recentOrders: any[]
  topProducts: any[]
  chartData: { date: string; sales: number }[]
  productCount: number
  vendorName: string
}

export default function VendorDashboardClient({ stats, recentOrders, topProducts, chartData, productCount, vendorName }: Props) {
  const firstName = vendorName.split(' ')[0]

  // Dynamically mark setup steps based on real data
  const dynamicSteps = [
    { label: 'Store profile completed',  done: true },
    { label: 'Add payout details',       done: false },
    { label: 'Add at least 3 products',  done: productCount >= 3 },
    { label: 'Made your first sale',     done: (stats?.totalOrders ?? 0) > 0 },
    { label: 'Get your first 5 reviews', done: false },
  ]
  const completedSteps = dynamicSteps.filter(s => s.done).length

  const hasData = stats && stats.totalOrders > 0

  return (
    <>
      <style>{`
        .vd-grid { display: grid; gap: 20px; }
        .vd-stat-grid { grid-template-columns: repeat(4, 1fr); }
        .vd-stat-card {
          background: var(--vendor-card-bg, #0f1a35);
          border: 1px solid var(--vendor-card-border, #1e3a5f);
          border-radius: 14px; padding: 20px 22px;
          display: flex; align-items: flex-start; justify-content: space-between;
        }
        .vd-stat-label { font-family: var(--font-dm-sans); font-size: 0.82rem; color: var(--vendor-muted, #64748b); margin: 0 0 6px; }
        .vd-stat-value { font-family: var(--font-sora); font-size: 1.6rem; font-weight: 700; color: var(--vendor-heading, #fff); margin: 0 0 6px; }
        .vd-stat-change { font-family: var(--font-dm-sans); font-size: 0.78rem; color: #22c55e; }
        .vd-stat-change.neutral { color: var(--vendor-muted, #64748b); }
        .vd-stat-icon { width: 44px; height: 44px; border-radius: 10px; background: rgba(37,99,235,0.12); display: flex; align-items: center; justify-content: center; color: #2563eb; flex-shrink: 0; }

        .vd-main-grid { grid-template-columns: 1fr 360px; }
        .vd-card { background: var(--vendor-card-bg, #0f1a35); border: 1px solid var(--vendor-card-border, #1e3a5f); border-radius: 14px; padding: 22px; }
        .vd-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .vd-card-title { font-family: var(--font-sora); font-size: 0.95rem; font-weight: 600; color: var(--vendor-heading, #fff); margin: 0; }
        .vd-view-all { font-family: var(--font-dm-sans); font-size: 0.8rem; color: #2563eb; text-decoration: none; }
        .vd-view-all:hover { text-decoration: underline; }

        .vd-order-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--vendor-card-border, #1e3a5f); }
        .vd-order-row:last-child { border-bottom: none; }
        .vd-order-img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #1e3a5f; display: flex; align-items: center; justify-content: center; }
        .vd-order-img img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; }
        .vd-order-info { flex: 1; min-width: 0; }
        .vd-order-id { font-family: var(--font-sora); font-size: 0.82rem; font-weight: 600; color: var(--vendor-heading, #fff); }
        .vd-order-name { font-family: var(--font-dm-sans); font-size: 0.78rem; color: var(--vendor-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vd-status-badge { font-size: 0.72rem; font-family: var(--font-dm-sans); font-weight: 600; padding: 3px 10px; border-radius: 99px; white-space: nowrap; }
        .vd-order-amount { font-family: var(--font-sora); font-size: 0.85rem; font-weight: 600; color: var(--vendor-heading, #fff); white-space: nowrap; margin-left: 8px; }

        .vd-product-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--vendor-card-border, #1e3a5f); }
        .vd-product-row:last-child { border-bottom: none; }
        .vd-product-img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #1e3a5f; display: flex; align-items: center; justify-content: center; }
        .vd-product-img img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
        .vd-product-name { font-family: var(--font-dm-sans); font-size: 0.85rem; color: var(--vendor-heading, #fff); flex: 1; }
        .vd-product-sold { font-family: var(--font-dm-sans); font-size: 0.78rem; color: var(--vendor-muted, #64748b); width: 60px; text-align: center; }
        .vd-product-rev { font-family: var(--font-sora); font-size: 0.85rem; font-weight: 600; color: var(--vendor-heading, #fff); text-align: right; }
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

        @media (max-width: 1100px) { .vd-stat-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 900px) { .vd-main-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Greeting */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--vendor-heading, #fff)', margin: '0 0 4px' }}>
          Good {getHour()}, {firstName} 👋
        </h2>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '0.85rem', color: 'var(--vendor-muted, #64748b)', margin: 0 }}>
          {hasData ? "Here's what's happening with your store." : "Your store is set up. Start adding products to make your first sale!"}
        </p>
      </div>

      {/* Stat cards */}
      <div className="vd-grid vd-stat-grid" style={{ marginBottom: '20px' }}>
        {[
          { label: 'Total Sales',     value: fmt(stats?.totalSales ?? 0),         sub: hasData ? 'All time revenue' : 'No sales yet',          icon: <ShoppingBag size={20} />, live: hasData },
          { label: 'Total Orders',    value: String(stats?.totalOrders ?? 0),      sub: hasData ? 'Across all products' : 'No orders yet',      icon: <Tag size={20} />,         live: hasData },
          { label: 'Products Sold',   value: String(stats?.totalProductsSold ?? 0),sub: hasData ? 'Total units sold' : 'No units sold yet',     icon: <TrendingUp size={20} />,  live: hasData },
          { label: 'Your Listings',   value: String(productCount),                 sub: productCount > 0 ? 'Active products' : 'Add products to start selling', icon: <Eye size={20} />, live: productCount > 0 },
        ].map((s) => (
          <div key={s.label} className="vd-stat-card">
            <div>
              <p className="vd-stat-label">{s.label}</p>
              <p className="vd-stat-value">{s.value}</p>
              <p className={`vd-stat-change${s.live ? '' : ' neutral'}`}>{s.sub}</p>
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
                  <YAxis tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'var(--font-dm-sans)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
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
                  <span className="vd-th" style={{ width: 60, textAlign: 'center' }}>Sold</span>
                  <span className="vd-th" style={{ textAlign: 'right' }}>Revenue</span>
                </div>
                {topProducts.map((p) => (
                  <div key={p.name} className="vd-product-row">
                    <div className="vd-product-img">
                      {p.image ? <img src={p.image} alt={p.name} /> : <Package size={18} color="#64748b" />}
                    </div>
                    <span className="vd-product-name">{p.name}</span>
                    <span className="vd-product-sold">{p.sold}</span>
                    <span className="vd-product-rev">{fmt(p.revenue)}</span>
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
                  <div key={o.id} className="vd-order-row">
                    <div className="vd-order-img">
                      {o.productImage ? <img src={o.productImage} alt={o.productName} /> : <Package size={18} color="#64748b" />}
                    </div>
                    <div className="vd-order-info">
                      <div className="vd-order-id">#{o.shortId}</div>
                      <div className="vd-order-name">{o.productName}</div>
                    </div>
                    <span className="vd-status-badge" style={{ background: s.bg, color: s.color }}>{o.status}</span>
                    <span className="vd-order-amount">{fmt(o.amount)}</span>
                    <ChevronRight size={15} color="#64748b" />
                  </div>
                )
              })
            )}
          </div>

          {/* Store setup progress */}
          <div className="vd-card">
            <div className="vd-card-header">
              <h2 className="vd-card-title">Store Setup Progress</h2>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '0.78rem', color: '#22c55e', fontWeight: 600 }}>
                {completedSteps}/{dynamicSteps.length} completed
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