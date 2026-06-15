'use client'

import {
  ShoppingBag,
  Tag,
  Eye,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

const salesData = [
  { date: 'May 12', sales: 22000 },
  { date: 'May 13', sales: 35000 },
  { date: 'May 14', sales: 48000 },
  { date: 'May 15', sales: 28000 },
  { date: 'May 16', sales: 52000 },
  { date: 'May 17', sales: 67000 },
  { date: 'May 18', sales: 41000 },
  { date: 'May 19', sales: 38000 },
]

const recentOrders = [
  { id: 'CM12345', product: 'UNILAG Hoodie (Green)',      items: 1, status: 'Delivered',  amount: 8000,    img: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=80&q=70' },
  { id: 'CM12344', product: 'AirPods Pro (2nd Gen)',      items: 1, status: 'Processing', amount: 120000,  img: 'https://images.unsplash.com/photo-1588156979435-379b9d802b0a?w=80&q=70' },
  { id: 'CM12343', product: 'Calculus Textbook',          items: 1, status: 'Shipped',    amount: 4500,    img: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=80&q=70' },
  { id: 'CM12342', product: 'HP Pavilion x360',           items: 1, status: 'Pending',    amount: 420000,  img: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=80&q=70' },
  { id: 'CM12341', product: 'Casio Scientific Calculator',items: 1, status: 'Delivered',  amount: 6000,    img: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=80&q=70' },
]

const topProducts = [
  { name: 'UNILAG Hoodie (Green)',  sold: 23, revenue: 184000, img: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=80&q=70' },
  { name: 'AirPods Pro (2nd Gen)', sold: 12, revenue: 1440000, img: 'https://images.unsplash.com/photo-1588156979435-379b9d802b0a?w=80&q=70' },
  { name: 'Calculus Textbook',     sold: 9,  revenue: 40500,   img: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=80&q=70' },
  { name: 'HP Pavilion x360',      sold: 7,  revenue: 2940000, img: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=80&q=70' },
]

const setupSteps = [
  { label: 'Store profile completed',  done: true },
  { label: 'Add store banner',         done: true },
  { label: 'Add payout details',       done: true },
  { label: 'Add at least 3 products',  done: true },
  { label: 'Get your first 5 reviews', done: false },
]

const statusColors: Record<string, { bg: string; color: string }> = {
  Delivered:  { bg: '#dcfce7', color: '#16a34a' },
  Processing: { bg: '#dbeafe', color: '#2563eb' },
  Shipped:    { bg: '#ede9fe', color: '#7c3aed' },
  Pending:    { bg: '#fef9c3', color: '#ca8a04' },
}

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG')
}

export default function VendorDashboardPage() {
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
        .vd-stat-change { font-family: var(--font-dm-sans); font-size: 0.78rem; color: #22c55e; display: flex; align-items: center; gap: 3px; }
        .vd-stat-change.down { color: #ef4444; }
        .vd-stat-icon { width: 44px; height: 44px; border-radius: 10px; background: rgba(37,99,235,0.12); display: flex; align-items: center; justify-content: center; color: #2563eb; flex-shrink: 0; }

        .vd-main-grid { grid-template-columns: 1fr 360px; }
        .vd-card {
          background: var(--vendor-card-bg, #0f1a35);
          border: 1px solid var(--vendor-card-border, #1e3a5f);
          border-radius: 14px; padding: 22px;
        }
        .vd-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .vd-card-title { font-family: var(--font-sora); font-size: 0.95rem; font-weight: 600; color: var(--vendor-heading, #fff); margin: 0; }
        .vd-view-all { font-family: var(--font-dm-sans); font-size: 0.8rem; color: #2563eb; text-decoration: none; }
        .vd-view-all:hover { text-decoration: underline; }

        .vd-date-btn {
          display: flex; align-items: center; gap: 6px;
          background: var(--vendor-btn-bg, rgba(255,255,255,0.05));
          border: 1px solid var(--vendor-card-border, #1e3a5f);
          border-radius: 8px; padding: 6px 12px;
          font-family: var(--font-dm-sans); font-size: 0.8rem;
          color: var(--vendor-muted, #94a3b8); cursor: pointer;
        }

        /* Orders */
        .vd-order-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--vendor-card-border, #1e3a5f); }
        .vd-order-row:last-child { border-bottom: none; }
        .vd-order-img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
        .vd-order-info { flex: 1; min-width: 0; }
        .vd-order-id { font-family: var(--font-sora); font-size: 0.82rem; font-weight: 600; color: var(--vendor-heading, #fff); }
        .vd-order-name { font-family: var(--font-dm-sans); font-size: 0.78rem; color: var(--vendor-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vd-order-meta { font-family: var(--font-dm-sans); font-size: 0.72rem; color: var(--vendor-muted, #64748b); }
        .vd-status-badge { font-size: 0.72rem; font-family: var(--font-dm-sans); font-weight: 600; padding: 3px 10px; border-radius: 99px; white-space: nowrap; }
        .vd-order-amount { font-family: var(--font-sora); font-size: 0.85rem; font-weight: 600; color: var(--vendor-heading, #fff); white-space: nowrap; margin-left: 8px; }
        .vd-order-chevron { color: var(--vendor-muted, #64748b); flex-shrink: 0; }

        /* Products table */
        .vd-product-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--vendor-card-border, #1e3a5f); }
        .vd-product-row:last-child { border-bottom: none; }
        .vd-product-img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
        .vd-product-name { font-family: var(--font-dm-sans); font-size: 0.85rem; color: var(--vendor-heading, #fff); flex: 1; }
        .vd-product-sold { font-family: var(--font-dm-sans); font-size: 0.78rem; color: var(--vendor-muted, #64748b); width: 60px; text-align: center; }
        .vd-product-rev { font-family: var(--font-sora); font-size: 0.85rem; font-weight: 600; color: var(--vendor-heading, #fff); text-align: right; }
        .vd-product-table-header { display: flex; align-items: center; gap: 12px; padding: 0 0 8px; border-bottom: 1px solid var(--vendor-card-border, #1e3a5f); margin-bottom: 4px; }
        .vd-th { font-family: var(--font-dm-sans); font-size: 0.72rem; color: var(--vendor-muted, #64748b); text-transform: uppercase; letter-spacing: 0.05em; }

        /* Setup progress */
        .vd-setup-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
        .vd-setup-label { font-family: var(--font-dm-sans); font-size: 0.85rem; color: var(--vendor-heading, #fff); }
        .vd-setup-label.done { color: var(--vendor-muted, #64748b); text-decoration: line-through; }

        /* Tips card */
        .vd-tips-card {
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
          border-radius: 14px; padding: 22px;
          display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
          margin-top: 16px;
        }
        .vd-tips-card h3 { font-family: var(--font-sora); font-size: 1rem; font-weight: 700; color: white; margin: 0 0 6px; }
        .vd-tips-card p { font-family: var(--font-dm-sans); font-size: 0.8rem; color: rgba(255,255,255,0.8); margin: 0 0 14px; line-height: 1.5; }
        .vd-tips-btn { background: white; color: #1e40af; border: none; border-radius: 8px; padding: 9px 16px; font-family: var(--font-dm-sans); font-size: 0.82rem; font-weight: 600; cursor: pointer; }

        /* Light mode */
        html.light .vd-stat-card, html[data-theme="light"] .vd-stat-card,
        html.light .vd-card, html[data-theme="light"] .vd-card {
          background: #ffffff; border-color: #e2e8f0;
        }
        html.light .vd-stat-label, html[data-theme="light"] .vd-stat-label,
        html.light .vd-order-name, html[data-theme="light"] .vd-order-name,
        html.light .vd-order-meta, html[data-theme="light"] .vd-order-meta,
        html.light .vd-product-sold, html[data-theme="light"] .vd-product-sold,
        html.light .vd-th, html[data-theme="light"] .vd-th { color: #94a3b8; }
        html.light .vd-stat-value, html[data-theme="light"] .vd-stat-value,
        html.light .vd-card-title, html[data-theme="light"] .vd-card-title,
        html.light .vd-order-id, html[data-theme="light"] .vd-order-id,
        html.light .vd-order-amount, html[data-theme="light"] .vd-order-amount,
        html.light .vd-product-name, html[data-theme="light"] .vd-product-name,
        html.light .vd-product-rev, html[data-theme="light"] .vd-product-rev,
        html.light .vd-setup-label, html[data-theme="light"] .vd-setup-label { color: #0f172a; }
        html.light .vd-order-row, html[data-theme="light"] .vd-order-row,
        html.light .vd-product-row, html[data-theme="light"] .vd-product-row,
        html.light .vd-product-table-header, html[data-theme="light"] .vd-product-table-header,
        html.light .vd-setup-row + .vd-setup-row, html[data-theme="light"] .vd-setup-row + .vd-setup-row { border-color: #f1f5f9; }
        html.light .vd-stat-icon, html[data-theme="light"] .vd-stat-icon { background: #eff6ff; }
        html.light .vd-date-btn, html[data-theme="light"] .vd-date-btn { background: #f8fafc; border-color: #e2e8f0; color: #64748b; }
        html.light .vd-order-chevron, html[data-theme="light"] .vd-order-chevron { color: #cbd5e1; }

        @media (max-width: 1100px) { .vd-stat-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 900px) { .vd-main-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Stat cards */}
      <div className="vd-grid vd-stat-grid" style={{ marginBottom: '20px' }}>
        {[
          { label: 'Total Sales',    value: fmt(256780), change: '+18.6%', icon: <ShoppingBag size={20} /> },
          { label: 'Orders',         value: '42',        change: '+12.4%', icon: <Tag size={20} /> },
          { label: 'Products Sold',  value: '68',        change: '+15.3%', icon: <TrendingUp size={20} /> },
          { label: 'Store Views',    value: '1,340',     change: '+20.1%', icon: <Eye size={20} /> },
        ].map((s) => (
          <div key={s.label} className="vd-stat-card">
            <div>
              <p className="vd-stat-label">{s.label}</p>
              <p className="vd-stat-value">{s.value}</p>
              <p className="vd-stat-change">↑ {s.change} vs last 7 days</p>
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
              <h2 className="vd-card-title">Sales Overview</h2>
              <button className="vd-date-btn">📅 May 12 – May 19, 2024 ▾</button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={salesData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'var(--font-dm-sans)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'var(--font-dm-sans)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), 'Sales']} contentStyle={{ background: '#0f1a35', border: '1px solid #1e3a5f', borderRadius: 8, fontFamily: 'var(--font-dm-sans)', fontSize: 12 }} />
                <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Best selling products */}
          <div className="vd-card">
            <div className="vd-card-header">
              <h2 className="vd-card-title">Best Selling Products</h2>
              <a href="/vendor/listings" className="vd-view-all">View all</a>
            </div>
            <div className="vd-product-table-header">
              <div style={{ width: 40 }} />
              <span className="vd-th" style={{ flex: 1 }}>Product</span>
              <span className="vd-th" style={{ width: 60, textAlign: 'center' }}>Sold</span>
              <span className="vd-th" style={{ textAlign: 'right' }}>Revenue</span>
            </div>
            {topProducts.map((p) => (
              <div key={p.name} className="vd-product-row">
                <img src={p.img} alt={p.name} className="vd-product-img" />
                <span className="vd-product-name">{p.name}</span>
                <span className="vd-product-sold">{p.sold}</span>
                <span className="vd-product-rev">{fmt(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="vd-grid" style={{ gap: '20px' }}>
          {/* Recent orders */}
          <div className="vd-card">
            <div className="vd-card-header">
              <h2 className="vd-card-title">Recent Orders</h2>
              <a href="/vendor/orders" className="vd-view-all">View all</a>
            </div>
            {recentOrders.map((o) => {
              const s = statusColors[o.status] ?? { bg: '#f1f5f9', color: '#64748b' }
              return (
                <div key={o.id} className="vd-order-row">
                  <img src={o.img} alt={o.product} className="vd-order-img" />
                  <div className="vd-order-info">
                    <div className="vd-order-id">#{o.id}</div>
                    <div className="vd-order-name">{o.product}</div>
                    <div className="vd-order-meta">{o.items} item</div>
                  </div>
                  <span className="vd-status-badge" style={{ background: s.bg, color: s.color }}>{o.status}</span>
                  <span className="vd-order-amount">{fmt(o.amount)}</span>
                  <ChevronRight size={15} className="vd-order-chevron" />
                </div>
              )
            })}
          </div>

          {/* Store setup progress */}
          <div className="vd-card">
            <div className="vd-card-header">
              <h2 className="vd-card-title">Store Setup Progress</h2>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '0.78rem', color: '#22c55e', fontWeight: 600 }}>4/5 completed</span>
            </div>
            {setupSteps.map((s) => (
              <div key={s.label} className="vd-setup-row">
                {s.done
                  ? <CheckCircle2 size={18} color="#22c55e" />
                  : <Circle size={18} color="#64748b" />}
                <span className={`vd-setup-label${s.done ? ' done' : ''}`}>{s.label}</span>
              </div>
            ))}

            {/* Tips */}
            <div className="vd-tips-card">
              <div>
                <h3>Tips to grow your store</h3>
                <p>List high-quality products, keep your prices competitive and respond to buyers fast.</p>
                <button className="vd-tips-btn">View Tips →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}