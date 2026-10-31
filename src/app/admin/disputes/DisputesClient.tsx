'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Inbox, Phone, Banknote, Undo2, CheckCircle2, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Item = {
  itemId: string
  orderId: string
  product: string
  quantity: number
  subtotal: number
  reason: string | null
  orderedAt: string | null
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  delivery: string | null
  store: string
  sellerPhone: string | null
  resolution: string | null
  resolvedAt: string | null
  note: string | null
}

type Panel = { id: string; mode: 'release' | 'refund' } | null

const naira = (n: number) => '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 2 })
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
// Same maths as the payout function: 5% commission rounded to 2 decimals
const payoutOf = (subtotal: number) => subtotal - Math.round(subtotal * 5) / 100
const tel = (p: string | null) => (p ? 'tel:' + p.replace(/[^\d+]/g, '') : undefined)

export default function DisputesClient({
  items: initial,
  resolved,
  loadError,
}: {
  items: Item[]
  resolved: boolean
  loadError: string | null
}) {
  const supabase = useMemo(() => createClient(), [])

  const [items, setItems] = useState(initial)
  const [panel, setPanel] = useState<Panel>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function decide(it: Item, decision: 'release' | 'refund') {
    setError(null)
    if (note.trim().length < 5) return setError('Please write a note of at least 5 characters explaining your decision.')
    setBusy(it.itemId)
    const { error: rpcErr } = await supabase.rpc('admin_resolve_dispute', {
      p_item_id: it.itemId,
      p_decision: decision,
      p_note: note.trim(),
    })
    setBusy(null)
    if (rpcErr) return setError(rpcErr.message)
    setItems((list) => list.filter((i) => i.itemId !== it.itemId))
    setPanel(null)
    setNote('')
    setNotice(
      decision === 'refund'
        ? `Decision saved. Now send ${naira(it.subtotal)} back to ${it.buyerName || 'the buyer'} from your Paystack dashboard. This step is still manual.`
        : `Decision saved. ${naira(payoutOf(it.subtotal))} was added to ${it.store}'s wallet.`
    )
  }

  return (
    <div className="dq">


      <div className="dq-head">
        <div>
          <h1>Disputes</h1>
          <p>{resolved ? 'Recently resolved disputes.' : items.length === 0 ? 'Nothing waiting.' : `${items.length} open. The money is frozen until you decide.`}</p>
        </div>
        <div className="dq-switch" role="tablist" aria-label="Dispute view">
          <Link href="/admin/disputes" className={!resolved ? 'is-active' : ''} role="tab" aria-selected={!resolved}>Open</Link>
          <Link href="/admin/disputes?view=resolved" className={resolved ? 'is-active' : ''} role="tab" aria-selected={resolved}>Resolved</Link>
        </div>
      </div>

      {notice && (
        <div className="dq-notice" role="status">
          <CheckCircle2 size={16} aria-hidden /> {notice}
        </div>
      )}
      {(loadError || error) && (
        <div className="dq-err" role="alert">
          <AlertCircle size={16} aria-hidden /> {loadError || error}
        </div>
      )}

      {items.length === 0 && !loadError ? (
        <div className="dq-empty">
          <Inbox size={28} strokeWidth={1.5} aria-hidden />
          <h2>{resolved ? 'No resolved disputes yet' : 'All clear'}</h2>
          <p>{resolved ? 'Decisions you make will be listed here.' : 'New disputes will appear here.'}</p>
        </div>
      ) : (
        items.map((it) => {
          const open = panel?.id === it.itemId ? panel.mode : null
          const working = busy === it.itemId
          return (
            <article key={it.itemId} className="dq-card">
              <header className="dq-card-head">
                <div>
                  <h2>{it.product}</h2>
                  <p>Quantity {it.quantity} · {naira(it.subtotal)} · Ordered {fmt(it.orderedAt)}</p>
                </div>
                {resolved && (
                  <span className={`dq-pill ${it.resolution === 'refund' ? 'is-refund' : 'is-release'}`}>
                    {it.resolution === 'refund' ? 'Refunded buyer' : 'Paid vendor'}
                  </span>
                )}
              </header>

              <div className="dq-reason">
                <strong>Buyer&apos;s reason</strong>
                <p>{it.reason || 'No reason given.'}</p>
              </div>

              <div className="dq-people">
                <div>
                  <span className="dq-label">Buyer</span>
                  <strong>{it.buyerName || 'No name on file'}</strong>
                  {it.buyerEmail && <span>{it.buyerEmail}</span>}
                  {it.buyerPhone && (
                    <a href={tel(it.buyerPhone)}><Phone size={13} aria-hidden /> {it.buyerPhone}</a>
                  )}
                  {it.delivery && <span>Method: {it.delivery}</span>}
                </div>
                <div>
                  <span className="dq-label">Vendor</span>
                  <strong>{it.store}</strong>
                  {it.sellerPhone && (
                    <a href={tel(it.sellerPhone)}><Phone size={13} aria-hidden /> {it.sellerPhone}</a>
                  )}
                </div>
              </div>

              {resolved ? (
                <div className="dq-done">
                  <span className="dq-label">Your note{it.resolvedAt ? ` · ${fmt(it.resolvedAt)}` : ''}</span>
                  <p>{it.note}</p>
                </div>
              ) : (
                <>
                  {!open && (
                    <div className="dq-actions">
                      <button className="dq-btn dq-pay" onClick={() => { setPanel({ id: it.itemId, mode: 'release' }); setNote(''); setError(null); setNotice(null) }}>
                        <Banknote size={16} aria-hidden /> Pay the vendor
                      </button>
                      <button className="dq-btn dq-refund" onClick={() => { setPanel({ id: it.itemId, mode: 'refund' }); setNote(''); setError(null); setNotice(null) }}>
                        <Undo2 size={16} aria-hidden /> Refund the buyer
                      </button>
                    </div>
                  )}

                  {open && (
                    <div className="dq-confirm">
                      <div className="dq-effect">
                        <Info size={16} aria-hidden />
                        <span>
                          {open === 'release'
                            ? `${it.store} receives ${naira(payoutOf(it.subtotal))} in their wallet (${naira(it.subtotal)} minus the 5% commission). The buyer is not refunded.`
                            : `The buyer is owed ${naira(it.subtotal)} for this item. The vendor receives nothing. You must send the refund manually from Paystack for now. The 2% service fee and any delivery fee are not part of this amount.`}
                        </span>
                      </div>
                      <label htmlFor={`note-${it.itemId}`}>Your note (saved with the decision)</label>
                      <textarea
                        id={`note-${it.itemId}`}
                        rows={3}
                        maxLength={400}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What you checked and why you decided this"
                      />
                      <div className="dq-actions">
                        <button
                          className={`dq-btn ${open === 'release' ? 'dq-pay' : 'dq-refund'}`}
                          disabled={working}
                          onClick={() => decide(it, open)}
                        >
                          {working && <Loader2 size={16} className="dq-spin" aria-hidden />}
                          {open === 'release' ? 'Confirm: pay the vendor' : 'Confirm: refund the buyer'}
                        </button>
                        <button className="dq-ghost" disabled={working} onClick={() => setPanel(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </article>
          )
        })
      )}
    </div>
  )
}
