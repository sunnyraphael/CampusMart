'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeading } from '@/components/vendor/Workspace'
import { transactionsCsv } from '@/lib/vendor/export'
import {
  Wallet,
  Clock,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Hourglass,
  Receipt,
  Info,
  Download,
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
  function download() {
    const url = URL.createObjectURL(new Blob([transactionsCsv(filtered)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'campusmart-transactions.csv'; document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="er-page">


      <PageHeading eyebrow="Know where you stand" title="Your earnings" description="Your wallet and pending earnings, with a clear view of each transaction." actions={<button className="vx-btn vx-btn-secondary" onClick={download} disabled={!!txError || !filtered.length}><Download size={16} />Export transactions</button>} />

      <section className="er-hero" aria-label="Wallet balance">
        <div className="er-hero-icon" aria-hidden>
          <Wallet size={22} strokeWidth={1.75} />
        </div>
        <div className="er-hero-body">
          <span className="er-label">Available in wallet</span>
          <strong className="er-hero-amount">{naira(balance)}</strong>
          <span className="er-hint">Funds released to your CampusMart wallet, after the 5% commission.</span>
        </div>
      </section>

      <div className="vx-notice"><Info size={17} /><span>Wallet funds and bank transfers are separate. Manage your bank details in <Link href="/vendor/settings#payout" className="vx-text-link">payout settings</Link>.</span></div>

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
            <p>{filter === 'all' ? 'Once earnings are released, they will appear here.' : 'No transactions match this filter.'}</p>
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
      <p className="vx-chat-help">Showing up to the latest 100 transactions. Export includes the currently selected filter.</p>
    </div>
  )
}
