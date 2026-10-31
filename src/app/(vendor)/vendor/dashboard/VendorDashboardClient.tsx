'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, ArrowRight, Package, ShoppingBag, TrendingUp, Wallet, Check, ArrowUpRight, Circle, ShieldCheck } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PageHeading, Panel, EmptyState } from '@/components/vendor/Workspace'
import ShareStoreButton from '@/components/vendor/ShareStoreButton'
import type { Overview } from '@/lib/vendor/overview'

const fmt = (n: number) => '₦' + n.toLocaleString('en-NG')
const compact = (n: number) => '₦' + new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
type Setup = { profile: boolean; payout: boolean; verified: boolean; listing: boolean }

export default function VendorDashboardClient({ overview, sellerId, vendorName, setup }: { overview: Overview; sellerId: string; vendorName: string; setup: Setup }) {
  const [exact, setExact] = useState(false)
  const { stats, attention, chartData, recentOrders, topProducts } = overview
  const steps = [
    { label: 'Introduce your store', done: setup.profile, href: '/vendor/settings#store-profile' },
    { label: 'Add your payout details', done: setup.payout, href: '/vendor/settings#payout' },
    { label: 'Publish your first listing', done: setup.listing, href: '/vendor/listings/new' },
    { label: 'Verify your identity', done: setup.verified, href: '/vendor/verify' },
  ]
  const completed = steps.filter(s => s.done).length
  return <div className="vx-page">
    <PageHeading eyebrow="Your store, at a glance" title={`Welcome back, ${vendorName.split(' ')[0]}.`} description="A little progress today. A stronger campus business tomorrow." actions={<><ShareStoreButton sellerId={sellerId} /><Link className="vx-btn" href="/vendor/listings/new"><Plus size={17} />New listing</Link></>} />
    <section className="vx-stats" aria-label="Store performance">
      <button className="vx-stat vx-stat-button" onClick={() => setExact(!exact)} aria-pressed={exact} aria-label="Toggle exact total sales"><span className="vx-stat-top">Total sales <Wallet size={18} /></span><strong>{(exact ? fmt : compact)(stats.totalSales)}</strong><span>Paid orders, excluding refunds <span className="vx-text-link">{exact ? 'Compact view' : 'Exact amount'}</span></span></button>
      {[{ label: 'Paid orders', value: stats.totalOrders, text: 'Across your store', icon: ShoppingBag }, { label: 'Units sold', value: stats.unitsSold, text: 'Excluding refunded items', icon: TrendingUp }, { label: 'Active listings', value: stats.activeListings, text: 'Currently published', icon: Package }].map(({ label, value, text, icon: Icon }) => <div className="vx-stat" key={label}><span className="vx-stat-top">{label}<Icon size={18} /></span><strong>{value}</strong><span>{text}</span></div>)}
    </section>
    <div className="vx-attention" aria-label="Store tasks"><span className="vx-attention-label">Up next</span><Link href="/vendor/orders"><ShoppingBag size={16} /><strong>{attention.orders}</strong> orders to move forward<ArrowUpRight size={14} /></Link><Link href="/vendor/listings?stock=low"><Package size={16} /><strong>{attention.lowStock}</strong> listings to restock<ArrowUpRight size={14} /></Link><Link href="/vendor/listings?status=draft"><Circle size={15} /><strong>{attention.drafts}</strong> drafts to finish<ArrowUpRight size={14} /></Link></div>
    <div className="vx-dashboard-grid"><div className="vx-stack">
      <Panel title="Sales activity" description="Your last 7 days · Nigeria time"><div className="vx-chart-total"><strong>{fmt(chartData.reduce((sum, d) => sum + d.sales, 0))}</strong><span>Gross item sales</span></div>{chartData.some(d => d.sales > 0) ? <div className="vx-chart" role="img" aria-label={chartData.map(d => `${d.date}: ${fmt(d.sales)}`).join('; ')}><ResponsiveContainer width="100%" height={225} minWidth={0}><LineChart data={chartData} margin={{ top: 15, right: 12, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--vx-border)" /><XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--vx-muted)' }} axisLine={false} tickLine={false} /><YAxis tickFormatter={v => compact(Number(v))} tick={{ fontSize: 11, fill: 'var(--vx-muted)' }} axisLine={false} tickLine={false} /><Tooltip formatter={value => [fmt(Number(value)), 'Sales']} contentStyle={{ background: 'var(--vx-card)', color: 'var(--vx-text)', border: '1px solid var(--vx-border)', borderRadius: 10 }} /><Line dataKey="sales" type="monotone" stroke="#2563eb" strokeWidth={3} dot={false} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <EmptyState title="Your next chapter starts here" action={<Link href="/vendor/listings/new" className="vx-text-link">Create a listing <ArrowRight size={15} /></Link>}>Paid sales will appear here as your store grows.</EmptyState>}</Panel>
      <Panel title="Recent orders" description="The latest purchases from your store" href="/vendor/orders">{!recentOrders.length ? <EmptyState title="Ready for your first order">Orders will appear here when buyers pay for your products.</EmptyState> : <div className="vx-order-list">{recentOrders.map(o => <Link key={o.id} href={`/vendor/orders/${o.id}`} className="vx-order-row"><span className="vx-product-thumb">{o.image ? <img src={o.image} alt="" /> : <Package size={21} />}</span><div className="vx-order-info"><strong>#{o.id.slice(0, 8).toUpperCase()}</strong><span>{o.productName}{o.itemCount > 1 ? ` + ${o.itemCount - 1} more` : ''}</span></div><span className={`vx-pill ${o.status}`}>{o.status}</span><strong>{fmt(o.amount)}</strong><ArrowUpRight size={16} /></Link>)}</div>}</Panel>
    </div><div className="vx-stack">
      <Panel title="Make your store ready" description={`${completed} of ${steps.length} essentials completed`}><progress className="vx-progress" value={completed} max={steps.length} aria-label="Store setup progress" /><div className="vx-checklist">{steps.map(s => <Link key={s.label} href={s.href} className={s.done ? 'is-done' : ''}><span className="vx-check-circle">{s.done ? <Check size={13} /> : null}</span>{s.label}<ArrowUpRight size={14} /></Link>)}</div></Panel>
      <Panel title="Top products" description="Ranked by item sales" href="/vendor/listings">{!topProducts.length ? <p className="vx-muted vx-small">Your bestsellers will appear after your first paid sale.</p> : <ol className="vx-top-products">{topProducts.map((p, i) => <li key={p.id}><span className="vx-rank">0{i + 1}</span><div><strong>{p.name}</strong><span>{p.sold} sold</span></div><strong>{compact(p.revenue)}</strong></li>)}</ol>}</Panel>
      <section className="vx-guide-card"><ShieldCheck size={25} /><h2>Build trust. Grow steadily.</h2><p>Better photos, clear delivery times, and thoughtful replies go a long way.</p><Link href="/vendor/guide">Explore the vendor guide <ArrowRight size={16} /></Link></section>
    </div></div>
  </div>
}
