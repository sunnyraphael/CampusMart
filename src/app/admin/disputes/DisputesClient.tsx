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
      <style>{css}</style>

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

const css = `
.dq-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.dq-head h1{margin:0 0 4px;font-family:'Sora',sans-serif;font-size:1.6rem;letter-spacing:-.02em}
.dq-head p{margin:0;opacity:.7;font-size:.92rem}
.dq-switch{display:flex;gap:4px;padding:3px;background:#0b1530;border:1px solid #1e3a5f;border-radius:10px}
.dq-switch a{padding:6px 14px;border-radius:8px;color:#cfe0ff;font-size:.84rem;text-decoration:none;opacity:.75}
.dq-switch a.is-active{background:#2563eb;color:#fff;opacity:1}
.dq-switch a:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.dq-card{background:#0f1a35;border:1px solid #1e3a5f;border-radius:16px;padding:20px;margin-bottom:16px;min-width:0}
.dq-card-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.dq-card-head h2{margin:0 0 4px;font-family:'Sora',sans-serif;font-size:1.05rem}
.dq-card-head p{margin:0;font-size:.84rem;opacity:.7}
.dq-pill{align-self:flex-start;padding:4px 10px;border-radius:999px;font-size:.74rem;font-weight:600}
.dq-pill.is-release{background:#0e4d2f;color:#7ee2a8}
.dq-pill.is-refund{background:#4a3a0a;color:#ffd978}
.dq-reason{padding:12px 14px;margin-bottom:14px;border-radius:10px;background:#2a1414;border:1px solid #7a2222}
.dq-reason strong{display:block;margin-bottom:4px;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;color:#ffb4ab}
.dq-reason p{margin:0;font-size:.92rem;line-height:1.5;overflow-wrap:anywhere}
.dq-people{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:16px}
.dq-people>div{display:flex;flex-direction:column;gap:3px;font-size:.86rem;min-width:0;overflow-wrap:anywhere}
.dq-people a{display:inline-flex;align-items:center;gap:5px;color:#7fb0ff;text-decoration:none}
.dq-people a:hover{text-decoration:underline}
.dq-label{font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;opacity:.55}
.dq-done p{margin:4px 0 0;font-size:.9rem;line-height:1.5;opacity:.9;overflow-wrap:anywhere}
.dq-actions{display:flex;gap:10px;flex-wrap:wrap}
.dq-btn,.dq-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:10px;font:inherit;font-weight:600;font-size:.9rem;cursor:pointer;border:1px solid transparent}
.dq-pay{background:#15803d;color:#fff}
.dq-pay:hover:not(:disabled){background:#166534}
.dq-refund{background:#b45309;color:#fff}
.dq-refund:hover:not(:disabled){background:#92400e}
.dq-btn:disabled{opacity:.5;cursor:not-allowed}
.dq-ghost{background:none;border-color:#1e3a5f;color:#cfe0ff}
.dq-ghost:hover:not(:disabled){background:#142347;border-color:#2563eb}
.dq-btn:focus-visible,.dq-ghost:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.dq-confirm label{display:block;margin:12px 0 6px;font-size:.85rem;font-weight:500}
.dq-confirm textarea{width:100%;box-sizing:border-box;margin-bottom:12px;padding:11px 12px;background:#0b1530;border:1px solid #1e3a5f;border-radius:10px;color:#e6ecff;font:inherit;font-size:1rem;resize:vertical;color-scheme:dark}
.dq-confirm textarea:focus-visible{outline:2px solid #2563eb;outline-offset:1px}
.dq-effect{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:10px;background:#0b1530;border:1px solid #1e3a5f;font-size:.86rem;line-height:1.5}
.dq-effect svg{flex:none;margin-top:2px;color:#7fb0ff}
.dq-notice,.dq-err{display:flex;gap:8px;align-items:flex-start;margin-bottom:16px;padding:12px 14px;border-radius:10px;font-size:.88rem;line-height:1.5}
.dq-notice{background:#0d2a1c;border:1px solid #14532d;color:#b9f0cf}
.dq-err{background:#3a1212;border:1px solid #7a2222;color:#ffd5d5}
.dq-notice svg,.dq-err svg{flex:none;margin-top:2px}
.dq-empty{text-align:center;padding:56px 16px;border:1px dashed #1e3a5f;border-radius:16px;opacity:.85}
.dq-empty h2{margin:10px 0 4px;font-family:'Sora',sans-serif;font-size:1.05rem}
.dq-empty p{margin:0;font-size:.88rem;opacity:.7}
.dq-spin{animation:dq-spin .8s linear infinite}
@keyframes dq-spin{to{transform:rotate(360deg)}}
@media(max-width:560px){.dq-people{grid-template-columns:minmax(0,1fr)}.dq-card{padding:16px}.dq-actions .dq-btn{flex:1}}
@media(prefers-reduced-motion:reduce){.dq-spin{animation:none}}
`