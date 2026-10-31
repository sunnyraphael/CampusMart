'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2, RefreshCw, Inbox, AlertCircle, ExternalLink, ImageOff } from 'lucide-react'
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

  const [items, setItems] = useState(initial)
  const [panel, setPanel] = useState<Panel>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(item: Item, approve: boolean) {
    setError(null)
    if (!approve && reason.trim().length < 5) return setError('Please write a reason of at least 5 characters. The vendor will see it.')
    setBusy(item.sellerId)
    const { error: rpcErr } = await supabase.rpc('admin_review_kyc', {
      p_seller_id: item.sellerId,
      p_approve: approve,
      p_reason: approve ? null : reason.trim(),
    })
    setBusy(null)
    if (rpcErr) return setError(rpcErr.message)
    setItems((list) => list.filter((i) => i.sellerId !== item.sellerId))
    setPanel(null)
    setReason('')
  }

  return (
    <div className="vq">


      <div className="vq-head">
        <div>
          <h1>Verifications</h1>
          <p>{items.length === 0 ? 'Nothing waiting.' : `${items.length} waiting for review, oldest first.`}</p>
        </div>
        <button className="vq-ghost" onClick={() => router.refresh()}>
          <RefreshCw size={15} aria-hidden /> Refresh
        </button>
      </div>

      {(loadError || error) && (
        <div className="vq-err" role="alert">
          <AlertCircle size={16} aria-hidden /> {loadError || error}
        </div>
      )}

      {items.length === 0 && !loadError ? (
        <div className="vq-empty">
          <Inbox size={28} strokeWidth={1.5} aria-hidden />
          <h2>All caught up</h2>
          <p>New submissions will appear here.</p>
        </div>
      ) : (
        items.map((it) => {
          const open = panel?.id === it.sellerId ? panel.mode : null
          return (
            <article key={it.sellerId} className="vq-card">
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
                  <button className="vq-btn vq-yes" onClick={() => { setPanel({ id: it.sellerId, mode: 'approve' }); setError(null) }}>
                    <Check size={16} aria-hidden /> Approve
                  </button>
                  <button className="vq-btn vq-no" onClick={() => { setPanel({ id: it.sellerId, mode: 'reject' }); setReason(''); setError(null) }}>
                    <X size={16} aria-hidden /> Reject
                  </button>
                </div>
              )}

              {open === 'approve' && (
                <div className="vq-confirm">
                  <p>Approve {it.storeName}? They will receive the Verified Vendor badge straight away.</p>
                  <div className="vq-actions">
                    <button className="vq-btn vq-yes" disabled={busy === it.sellerId} onClick={() => decide(it, true)}>
                      {busy === it.sellerId && <Loader2 size={16} className="vq-spin" aria-hidden />} Confirm approval
                    </button>
                    <button className="vq-ghost" onClick={() => setPanel(null)} disabled={busy === it.sellerId}>Cancel</button>
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
                    <button className="vq-btn vq-no" disabled={busy === it.sellerId} onClick={() => decide(it, false)}>
                      {busy === it.sellerId && <Loader2 size={16} className="vq-spin" aria-hidden />} Confirm rejection
                    </button>
                    <button className="vq-ghost" onClick={() => setPanel(null)} disabled={busy === it.sellerId}>Cancel</button>
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
