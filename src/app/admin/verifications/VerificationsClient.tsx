'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2, RefreshCw, Inbox, AlertCircle, ExternalLink, ImageOff } from 'lucide-react'
import { AdminHeading, QueueSummary, QueueToolbar } from '@/components/admin/Workspace'
import { queueMatches } from '@/lib/admin/queues'
import { createClient } from '@/lib/supabase/client'

type Item = {
  sellerId: string
  storeName: string
  ownerName: string | null
  ownerEmail: string | null
  phone: string | null
  submittedAt: string | null
  selfieUrl: string | null
  idUrl: string | null
}

type Panel = { id: string; mode: 'approve' | 'reject' } | null

const fmt = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

function Photo({ url, label }: { url: string | null; label: string }) {
  return (
    <figure className="vq-photo">
      <div className="vq-frame">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label} full size in a new tab`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} />
            <span className="vq-open"><ExternalLink size={13} aria-hidden /> Full size</span>
          </a>
        ) : (
          <span className="vq-missing"><ImageOff size={22} aria-hidden /> Not available</span>
        )}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

export default function VerificationsClient({ items: initial, loadError }: { items: Item[]; loadError: string | null }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const items=initial
  const [refreshing,startTransition]=useTransition()
  const [query,setQuery]=useState('')
  const [documents,setDocuments]=useState('all')
  const [panel, setPanel] = useState<Panel>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(item: Item, approve: boolean) {
    if(busy||refreshing)return
    setError(null)
    if (!approve && reason.trim().length < 5) return setError('Please write a reason of at least 5 characters. The vendor will see it.')
    setBusy(item.sellerId)
    try {
    const { error: rpcErr } = await supabase.rpc('admin_review_kyc', {
      p_seller_id: item.sellerId,
      p_approve: approve,
      p_reason: approve ? null : reason.trim(),
    })
    setBusy(null)
    if (rpcErr) return setError(rpcErr.message)
    startTransition(()=>router.refresh())
    setPanel(null)
    setReason('')
    } catch {setError('The review could not be saved. Check your connection and retry.')} finally {setBusy(null)}
  }

  const shown=items.filter(i=>queueMatches(query,i.storeName,i.ownerName,i.ownerEmail,i.phone,i.sellerId)&&(documents==='all'||(documents==='available'?!!i.selfieUrl&&!!i.idUrl:!i.selfieUrl||!i.idUrl)))
  return (
    <div className="vq">


      <AdminHeading title="Verifications" description="Review vendor documents and make a clear, recorded decision." actions={<button className="vq-ghost" disabled={refreshing||!!busy} onClick={()=>startTransition(()=>router.refresh())}><RefreshCw size={15} aria-hidden />Refresh</button>}/>
      <QueueSummary items={[{label:'Awaiting review',value:items.length},{label:'Images available',value:items.filter(i=>i.selfieUrl&&i.idUrl).length},{label:'Images unavailable',value:items.filter(i=>!i.selfieUrl||!i.idUrl).length}]}/>
      <QueueToolbar query={query} onQuery={setQuery} placeholder="Search vendors or owners" count={`${shown.length} of ${items.length} loaded`}><select aria-label="Document filter" value={documents} onChange={e=>setDocuments(e.target.value)}><option value="all">All submissions</option><option value="available">Images available</option><option value="missing">Images unavailable</option></select></QueueToolbar>
      {(loadError || error) && (
        <div className="vq-err" role="alert">
          <AlertCircle size={16} aria-hidden /> {loadError || error}
        </div>
      )}

      {items.length>0&&!shown.length&&!loadError&&<div className="vq-empty"><h2>No matching submissions</h2><p>Try another name or reset the filters.</p><button className="buyer-btn" onClick={()=>{setQuery('');setDocuments('all')}}>Clear filters</button></div>}
      {items.length === 0 && !loadError ? (
        <div className="vq-empty">
          <Inbox size={28} strokeWidth={1.5} aria-hidden />
          <h2>All caught up</h2>
          <p>New submissions will appear here.</p>
        </div>
      ) : (
        shown.map((it) => {
          const open = panel?.id === it.sellerId ? panel.mode : null
          return (
            <article key={it.sellerId} id={`verification-${it.sellerId}`} className="vq-card">
              <header className="vq-card-head">
                <div>
                  <h2>{it.storeName}</h2>
                  <p>
                    {it.ownerName || 'No name on file'}
                    {it.ownerEmail ? ` · ${it.ownerEmail}` : ''}
                    {it.phone ? ` · ${it.phone}` : ''}
                  </p>
                </div>
                <span className="vq-time">Submitted {fmt(it.submittedAt)}</span>
              </header>

              <div className="vq-photos">
                <Photo url={it.selfieUrl} label="Selfie" />
                <Photo url={it.idUrl} label="School ID" />
              </div>

              <p className="vq-guide">
                Check that the face matches the ID photo, the ID text is readable, and the name looks like the store owner.
                Links expire after 10 minutes, so use Refresh if a photo stops loading.
              </p>

              {!open && (
                <div className="vq-actions">
                  <button className="vq-btn vq-yes" disabled={!!busy||refreshing} onClick={() => { setPanel({ id: it.sellerId, mode: 'approve' }); setError(null) }}>
                    <Check size={16} aria-hidden /> Approve
                  </button>
                  <button className="vq-btn vq-no" disabled={!!busy||refreshing} onClick={() => { setPanel({ id: it.sellerId, mode: 'reject' }); setReason(''); setError(null) }}>
                    <X size={16} aria-hidden /> Reject
                  </button>
                </div>
              )}

              {open === 'approve' && (
                <div className="vq-confirm">
                  <p>Approve {it.storeName}? They will receive the Verified Vendor badge straight away.</p>
                  <div className="vq-actions">
                    <button className="vq-btn vq-yes" disabled={!!busy||refreshing} onClick={() => decide(it, true)}>
                      {busy === it.sellerId && <Loader2 size={16} className="vq-spin" aria-hidden />} Confirm approval
                    </button>
                    <button className="vq-ghost" onClick={() => setPanel(null)} disabled={!!busy||refreshing}>Cancel</button>
                  </div>
                </div>
              )}

              {open === 'reject' && (
                <div className="vq-confirm">
                  <label htmlFor={`why-${it.sellerId}`}>Reason shown to the vendor</label>
                  <textarea
                    id={`why-${it.sellerId}`}
                    rows={3}
                    maxLength={300}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="For example: The ID photo is blurry. Please retake it in good light."
                  />
                  <div className="vq-actions">
                    <button className="vq-btn vq-no" disabled={!!busy||refreshing} onClick={() => decide(it, false)}>
                      {busy === it.sellerId && <Loader2 size={16} className="vq-spin" aria-hidden />} Confirm rejection
                    </button>
                    <button className="vq-ghost" onClick={() => setPanel(null)} disabled={!!busy||refreshing}>Cancel</button>
                  </div>
                </div>
              )}
            </article>
          )
        })
      )}
    </div>
  )
}
