'use client'

import { useMemo, useState } from 'react'
import {
  Wallet,
  Clock,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Hourglass,
  Receipt,
  Info,
} from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = Record<string, any>

type Props = {
  balance: number
  inProgress: number
  awaitingBuyer: number
  onHold: number
  releasing: { id: string; amount: number; autoReleaseAt: string | null }[]
  transactions: Tx[]
  txError: string | null
}

type Filter = 'all' | 'in' | 'out'

const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG')

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

// "sale_release" becomes "Sale release"
// Friendly names for known transaction types. Anything new falls back to auto-formatting.
const TYPE_LABELS: Record<string, string> = {
  earning: 'Sale earnings',
}

const prettify = (s?: string) => {
  if (!s) return 'Transaction'
  if (TYPE_LABELS[s]) return TYPE_LABELS[s]
  return s.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

// How long until an item is released automatically
function releaseIn(iso: string | null) {
  if (!iso) return 'Releases when the buyer confirms'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Releasing shortly'
  const days = Math.ceil(ms / 86400000)
  return days === 1 ? 'Auto-releases within a day' : `Auto-releases in ${days} days`
}

function statusTone(status?: string) {
  const s = (status ?? '').toLowerCase()
  if (['completed', 'success', 'successful', 'paid', 'released'].includes(s)) return 'good'
  if (['pending', 'processing'].includes(s)) return 'wait'
  if (['failed', 'reversed', 'cancelled', 'canceled', 'rejected'].includes(s)) return 'bad'
  return 'plain'
}

export default function EarningsClient({
  balance,
  inProgress,
  awaitingBuyer,
  onHold,
  releasing,
  transactions,
  txError,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [visible, setVisible] = useState(20)

  const filtered = useMemo(() => {
    if (filter === 'all') return transactions
    return transactions.filter((t) => (filter === 'in' ? Number(t.amount) >= 0 : Number(t.amount) < 0))
  }, [transactions, filter])

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'in', label: 'Money in' },
    { key: 'out', label: 'Money out' },
  ]

  const comingSoon = inProgress + awaitingBuyer

  return (
    <main className="er-page">
      <style>{css}</style>

      <header className="er-head">
        <h1>Earnings</h1>
        <p>Your wallet, the money on its way, and every movement on your account.</p>
      </header>

      <section className="er-hero" aria-label="Wallet balance">
        <div className="er-hero-icon" aria-hidden>
          <Wallet size={22} strokeWidth={1.75} />
        </div>
        <div className="er-hero-body">
          <span className="er-label">Available in wallet</span>
          <strong className="er-hero-amount">{naira(balance)}</strong>
          <span className="er-hint">Released after buyers confirm receipt, minus the 5% commission.</span>
        </div>
      </section>

      <section className="er-grid" aria-label="Money on its way">
        <div className="er-stat">
          <div className="er-stat-top">
            <Clock size={16} aria-hidden />
            <span className="er-label">On the way</span>
          </div>
          <strong className="er-stat-amount">{naira(comingSoon)}</strong>
          <span className="er-hint">
            {naira(inProgress)} to deliver, {naira(awaitingBuyer)} awaiting buyers
          </span>
        </div>

        <div className={`er-stat ${onHold > 0 ? 'is-hold' : ''}`}>
          <div className="er-stat-top">
            <ShieldAlert size={16} aria-hidden />
            <span className="er-label">On hold</span>
          </div>
          <strong className="er-stat-amount">{naira(onHold)}</strong>
          <span className="er-hint">{onHold > 0 ? 'Frozen while disputes are reviewed' : 'No disputes right now'}</span>
        </div>
      </section>

      {releasing.length > 0 && (
        <section className="er-panel" aria-labelledby="er-release-title">
          <h2 id="er-release-title" className="er-panel-title">
            <Hourglass size={16} aria-hidden /> Releasing soon
          </h2>
          <ul className="er-release-list">
            {releasing.map((r) => (
              <li key={r.id}>
                <span>{releaseIn(r.autoReleaseAt)}</span>
                <strong>{naira(r.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="er-panel" aria-labelledby="er-history-title">
        <div className="er-panel-head">
          <h2 id="er-history-title" className="er-panel-title">
            <Receipt size={16} aria-hidden /> Transaction history
          </h2>
          <div className="er-tabs" role="tablist" aria-label="Filter transactions">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={filter === t.key}
                className={`er-tab ${filter === t.key ? 'is-active' : ''}`}
                onClick={() => {
                  setFilter(t.key)
                  setVisible(20)
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {txError && (
          <div className="er-error" role="alert">
            <Info size={16} aria-hidden /> Could not load transactions: {txError}
          </div>
        )}

        {!txError && filtered.length === 0 ? (
          <div className="er-empty">
            <Receipt size={26} strokeWidth={1.5} aria-hidden />
            <h3>No transactions yet</h3>
            <p>Once a buyer confirms an order, your earnings will appear here.</p>
          </div>
        ) : (
          <ul className="er-list">
            {filtered.slice(0, visible).map((t) => {
              const amount = Number(t.amount ?? 0)
              const incoming = amount >= 0
              const commission = Number(t.commission_amount ?? 0)
              const gross = Number(t.gross_amount ?? 0)
              return (
                <li key={t.id} className="er-row">
                  <span className={`er-dot ${incoming ? 'in' : 'out'}`} aria-hidden>
                    {incoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  <div className="er-row-main">
                    <span className="er-row-title">{t.description || prettify(t.type)}</span>
                    <span className="er-row-meta">
                      {prettify(t.type)} · {fmtDate(t.created_at)}
                    </span>
                    {commission > 0 && gross > 0 && (
                      <span className="er-row-meta">
                        Sale {naira(gross)} · Fee {naira(commission)}
                      </span>
                    )}
                  </div>
                  <div className="er-row-side">
                    <strong className={incoming ? 'er-in' : 'er-out'}>
                      {incoming ? '+' : '-'}
                      {naira(Math.abs(amount))}
                    </strong>
                    {t.status && <span className={`er-badge ${statusTone(t.status)}`}>{prettify(t.status)}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {filtered.length > visible && (
          <button className="er-more" onClick={() => setVisible((v) => v + 20)}>
            Show more
          </button>
        )}
      </section>
    </main>
  )
}

const css = `
.er-page{max-width:980px;margin:0 auto;padding:32px 20px 96px;color:var(--text-primary,#e6ecff);font-family:'DM Sans',sans-serif}
.er-head h1{font-family:'Sora',sans-serif;font-size:1.75rem;font-weight:700;letter-spacing:-.02em;margin:0 0 6px}
.er-head p{margin:0 0 24px;opacity:.7;font-size:.95rem;max-width:56ch}
.er-label{font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;opacity:.7}
.er-hint{font-size:.82rem;opacity:.65;line-height:1.4}
.er-hero{display:flex;gap:16px;align-items:center;padding:22px;margin-bottom:14px;background:linear-gradient(135deg,#13224a 0%,#0f1a35 70%);border:1px solid #1e3a5f;border-radius:18px;color:#e6ecff;min-width:0}
.er-hero-icon{flex:none;width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:#2563eb;color:#fff}
.er-hero-body{display:flex;flex-direction:column;gap:4px;min-width:0}
.er-hero-amount{font-family:'Sora',sans-serif;font-size:2rem;line-height:1.1;letter-spacing:-.02em;overflow-wrap:anywhere}
.er-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:20px}
.er-stat{display:flex;flex-direction:column;gap:6px;padding:16px;background:#0f1a35;border:1px solid #1e3a5f;border-radius:16px;color:#e6ecff;min-width:0}
.er-stat-top{display:flex;align-items:center;gap:8px;color:#7fb0ff}
.er-stat-amount{font-family:'Sora',sans-serif;font-size:1.3rem;letter-spacing:-.01em;overflow-wrap:anywhere}
.er-stat.is-hold{border-color:#b42318}
.er-stat.is-hold .er-stat-top{color:#ffb4ab}
.er-panel{background:#0f1a35;border:1px solid #1e3a5f;border-radius:16px;padding:18px;margin-bottom:16px;color:#e6ecff;min-width:0}
.er-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.er-panel-title{display:flex;align-items:center;gap:8px;margin:0;font-family:'Sora',sans-serif;font-size:1rem;font-weight:600}
.er-release-list{list-style:none;margin:12px 0 0;padding:0}
.er-release-list li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;font-size:.9rem}
.er-release-list li+li{border-top:1px solid #1e3a5f}
.er-release-list span{opacity:.75}
.er-tabs{display:flex;gap:4px;padding:3px;background:#0b1530;border:1px solid #1e3a5f;border-radius:10px}
.er-tab{padding:6px 12px;background:none;border:0;border-radius:8px;color:inherit;font:inherit;font-size:.82rem;opacity:.7;cursor:pointer}
.er-tab:hover{opacity:1}
.er-tab.is-active{background:#2563eb;color:#fff;opacity:1}
.er-tab:focus-visible,.er-more:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.er-list{list-style:none;margin:0;padding:0}
.er-row{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:start;padding:14px 0}
.er-row+.er-row{border-top:1px solid #1e3a5f}
.er-dot{width:36px;height:36px;border-radius:10px;display:grid;place-items:center}
.er-dot.in{background:#0e4d2f;color:#7ee2a8}
.er-dot.out{background:#3a1d12;color:#ffb98a}
.er-row-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.er-row-title{font-weight:600;font-size:.92rem;overflow-wrap:anywhere}
.er-row-meta{font-size:.78rem;opacity:.6}
.er-row-side{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.er-in{color:#7ee2a8}
.er-out{color:#ffb98a}
.er-badge{padding:3px 9px;border-radius:999px;font-size:.7rem;background:#1e3a5f;color:#cfe0ff}
.er-badge.good{background:#0e4d2f;color:#7ee2a8}
.er-badge.wait{background:#4a3a0a;color:#ffd978}
.er-badge.bad{background:#b42318;color:#fff}
.er-empty{text-align:center;padding:40px 12px;opacity:.85}
.er-empty h3{font-family:'Sora',sans-serif;font-size:1rem;margin:10px 0 4px}
.er-empty p{margin:0;font-size:.88rem;opacity:.7}
.er-error{display:flex;gap:8px;align-items:flex-start;background:#3a1212;border:1px solid #7a2222;color:#ffd5d5;padding:12px 14px;border-radius:10px;font-size:.88rem}
.er-error svg{flex:none;margin-top:2px}
.er-more{display:block;width:100%;margin-top:12px;padding:10px;background:none;border:1px solid #1e3a5f;border-radius:10px;color:#cfe0ff;font:inherit;font-size:.88rem;cursor:pointer}
.er-more:hover{background:#142347;border-color:#2563eb}
@media(min-width:1100px){.er-grid{gap:16px}}
@media(max-width:480px){.er-page{padding:20px 0 96px}.er-hero{padding:18px}.er-hero-amount{font-size:1.65rem}.er-stat{padding:14px}.er-stat-amount{font-size:1.1rem}.er-panel{padding:14px}}
`