'use client'

import {useTransactionPin} from '@/components/admin/TransactionPin'
import { useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Inbox, Phone, ClipboardCheck, Undo2, CheckCircle2, Info } from 'lucide-react'
import { AdminHeading, QueueSummary, QueueToolbar } from '@/components/admin/Workspace'
import AdminRefresh from '@/components/admin/RefreshButton'
import { queueMatches } from '@/lib/admin/queues'

type Item = {
  isTrial?: boolean
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
  const {authorize,prompt}=useTransactionPin()

  const [removed,setRemoved] = useState<string[]>([])
  const items=initial.filter(item=>!removed.includes(item.itemId))
  const [query,setQuery]=useState('')
  const [kind,setKind]=useState('all')
  const [panel, setPanel] = useState<Panel>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function decide(it: Item, decision: 'release' | 'refund') {
    if (busy) return
    setError(null)
    if (note.trim().length < 5) return setError('Please write a note of at least 5 characters explaining your decision.')
    setBusy(it.itemId)
    try {
    const result = await authorize('resolve_dispute', {
      p_item_id: it.itemId,
      p_decision: decision,
      p_note: note.trim(),
    })
    setBusy(null)
    if ('error' in result) return setError(result.error)
    setRemoved(list=>[...list,it.itemId])
    setPanel(null)
    setNote('')
    setNotice(
      it.isTrial ? 'Trial dispute decision saved. No real refund or vendor credit was sent.' : decision === 'refund'
        ? `Decision saved. Now send ${naira(it.subtotal)} back to ${it.buyerName || 'the buyer'} by reviewing the scope and fee treatment in Payments & refunds. This decision does not itself send a bank refund.`
        : 'Dispute resolved. The order returns to delivery review. Buyer confirmation and a separate admin approval are still required before vendor credit.'
    )
    } catch { setError('The decision could not be saved. Check your connection and retry.') } finally { setBusy(null) }
  }

  const shown=items.filter(i=>queueMatches(query,i.product,i.itemId,i.orderId,i.buyerName,i.buyerEmail,i.store,i.reason)&&(kind==='all'||(kind==='trial'?i.isTrial:!i.isTrial)))
  return (
    <div className="dq">


      <Link className="buyer-btn" href="/admin/payments">Open payments &amp; refunds</Link>
      <AdminHeading title="Disputes" description="Review buyer reports, record your decision and keep delivery review connected." actions={<AdminRefresh/>}/>
      <QueueSummary items={[{label:resolved?'Resolved in this view':'Open in this view',value:items.length},{label:'Real orders',value:items.filter(i=>!i.isTrial).length},{label:'Trial orders',value:items.filter(i=>i.isTrial).length}]}/>
        <div className="dq-switch" role="tablist" aria-label="Dispute view">
          <Link href="/admin/disputes" className={!resolved ? 'is-active' : ''} role="tab" aria-selected={!resolved}>Open</Link>
          <Link href="/admin/disputes?view=resolved" className={resolved ? 'is-active' : ''} role="tab" aria-selected={resolved}>Resolved</Link>
        </div>
      <QueueToolbar query={query} onQuery={setQuery} placeholder="Search orders, buyers or vendors" count={`${shown.length} of ${items.length} loaded`}><select aria-label="Dispute order type" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All orders</option><option value="real">Real orders</option><option value="trial">Trial orders</option></select></QueueToolbar>
      <p className="buyer-help">Showing up to 100 recent disputes in this view.</p>
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

      {items.length>0&&!shown.length&&!loadError&&<div className="dq-empty"><h2>No matching disputes</h2><p>Try another reference or reset the filters.</p><button className="buyer-btn" onClick={()=>{setQuery('');setKind('all')}}>Clear filters</button></div>}
      {items.length === 0 && !loadError ? (
        <div className="dq-empty">
          <Inbox size={28} strokeWidth={1.5} aria-hidden />
          <h2>{resolved ? 'No resolved disputes yet' : 'All clear'}</h2>
          <p>{resolved ? 'Decisions you make will be listed here.' : 'New disputes will appear here.'}</p>
        </div>
      ) : (
        shown.map((it) => {
          const open = panel?.id === it.itemId ? panel.mode : null
          const working = busy === it.itemId
          return (
            <article key={it.itemId} id={`dispute-${it.itemId}`} className="dq-card">
              <header className="dq-card-head">
                <div>
                  <h2>{it.product}</h2>
                  <p>Quantity {it.quantity} · {naira(it.subtotal)} · Ordered {fmt(it.orderedAt)}</p>
                </div>
                {resolved && (
                  <span className={`dq-pill ${it.resolution === 'refund' ? 'is-refund' : 'is-release'}`}>
                    {it.resolution === 'refund' ? 'Refund approved' : 'Returned to delivery review'}
                  </span>
                )}
              </header>

              {it.isTrial&&<p className="buyer-notice">TRIAL ORDER - Dispute decisions are simulated. No real money is owed, refunded or credited.</p>}
              <Link className="aw-inline-link" style={{marginBottom:16}} href={resolved?'/admin/deliveries':'/admin/deliveries?view=held'}>Open delivery review queue</Link>
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
                      <button className="dq-btn dq-pay" disabled={!!busy} onClick={() => { setPanel({ id: it.itemId, mode: 'release' }); setNote(''); setError(null); setNotice(null) }}>
                        <ClipboardCheck size={16} aria-hidden /> Return to delivery review
                      </button>
                      <button className="dq-btn dq-refund" disabled={!!busy} onClick={() => { setPanel({ id: it.itemId, mode: 'refund' }); setNote(''); setError(null); setNotice(null) }}>
                        <Undo2 size={16} aria-hidden /> Approve refund
                      </button>
                    </div>
                  )}

                  {open && (
                    <div className="dq-confirm">
                      <div className="dq-effect">
                        <Info size={16} aria-hidden />
                        <span>
                          {it.isTrial ? 'This is a trial decision only. No real refund or vendor credit will be sent.' : open === 'release'
                            ? 'This closes the dispute and returns the item to delivery review. The buyer must confirm receipt again. Vendor credit requires a verified delivery code, verified payment and a separate approval in Deliveries.'
                            : `The buyer is owed ${naira(it.subtotal)} for this item. The vendor receives nothing. The refund transfer must be handled separately through the payment provider after integration. Any service fee or delivery fee is separate.`}
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
                          {open === 'release' ? 'Confirm: return to review' : 'Confirm refund decision'}
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
      {prompt}
    </div>
  )
}
