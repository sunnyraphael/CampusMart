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
      <style>{css}</style>

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

const css = `
.vq-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:20px}
.vq-head h1{margin:0 0 4px;font-family:'Sora',sans-serif;font-size:1.6rem;letter-spacing:-.02em}
.vq-head p{margin:0;opacity:.7;font-size:.92rem}
.vq-card{background:#0f1a35;border:1px solid #1e3a5f;border-radius:16px;padding:20px;margin-bottom:16px;min-width:0}
.vq-card-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.vq-card-head h2{margin:0 0 4px;font-family:'Sora',sans-serif;font-size:1.05rem}
.vq-card-head p{margin:0;font-size:.85rem;opacity:.75;overflow-wrap:anywhere}
.vq-time{font-size:.78rem;opacity:.6}
.vq-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:14px}
.vq-photo{margin:0}
.vq-frame{position:relative;aspect-ratio:4/3;border-radius:12px;background:#0b1530;border:1px solid #1e3a5f;overflow:hidden}
.vq-frame a{display:block;width:100%;height:100%}
.vq-frame img{width:100%;height:100%;object-fit:contain;display:block}
.vq-open{position:absolute;right:8px;bottom:8px;display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:rgba(7,13,31,.85);color:#cfe0ff;font-size:.72rem}
.vq-frame a:focus-visible{outline:2px solid #2563eb;outline-offset:-2px}
.vq-missing{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:.8rem;opacity:.6}
.vq-photo figcaption{margin-top:6px;font-size:.8rem;opacity:.7}
.vq-guide{margin:0 0 16px;font-size:.82rem;line-height:1.5;opacity:.7}
.vq-actions{display:flex;gap:10px;flex-wrap:wrap}
.vq-btn,.vq-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:10px;font:inherit;font-weight:600;font-size:.9rem;cursor:pointer;border:1px solid transparent}
.vq-yes{background:#15803d;color:#fff}
.vq-yes:hover:not(:disabled){background:#166534}
.vq-no{background:#b42318;color:#fff}
.vq-no:hover:not(:disabled){background:#912018}
.vq-btn:disabled{opacity:.5;cursor:not-allowed}
.vq-ghost{background:none;border-color:#1e3a5f;color:#cfe0ff}
.vq-ghost:hover:not(:disabled){background:#142347;border-color:#2563eb}
.vq-btn:focus-visible,.vq-ghost:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.vq-confirm{padding-top:4px}
.vq-confirm p{margin:0 0 12px;font-size:.9rem}
.vq-confirm label{display:block;margin-bottom:6px;font-size:.85rem;font-weight:500}
.vq-confirm textarea{width:100%;box-sizing:border-box;margin-bottom:12px;padding:11px 12px;background:#0b1530;border:1px solid #1e3a5f;border-radius:10px;color:#e6ecff;font:inherit;font-size:1rem;resize:vertical;color-scheme:dark}
.vq-confirm textarea:focus-visible{outline:2px solid #2563eb;outline-offset:1px}
.vq-err{display:flex;gap:8px;align-items:flex-start;margin-bottom:16px;padding:12px 14px;border-radius:10px;background:#3a1212;border:1px solid #7a2222;color:#ffd5d5;font-size:.88rem}
.vq-err svg{flex:none;margin-top:2px}
.vq-empty{text-align:center;padding:56px 16px;border:1px dashed #1e3a5f;border-radius:16px;opacity:.85}
.vq-empty h2{margin:10px 0 4px;font-family:'Sora',sans-serif;font-size:1.05rem}
.vq-empty p{margin:0;font-size:.88rem;opacity:.7}
.vq-spin{animation:vq-spin .8s linear infinite}
@keyframes vq-spin{to{transform:rotate(360deg)}}
@media(max-width:560px){.vq-photos{grid-template-columns:minmax(0,1fr)}.vq-card{padding:16px}.vq-actions .vq-btn{flex:1}}
@media(prefers-reduced-motion:reduce){.vq-spin{animation:none}}
`