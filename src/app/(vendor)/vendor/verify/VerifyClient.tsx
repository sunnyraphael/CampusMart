'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Camera,
  Contact,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  userId: string
  verified: boolean
  status: string
  reason: string | null
  submittedAt: string | null
}

type Kind = 'selfie' | 'id'

const MAX_SIZE = 5 * 1024 * 1024
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function VerifyClient({ userId, verified, status: initialStatus, reason, submittedAt: initialSubmitted }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [status, setStatus] = useState(initialStatus)
  const [submittedAt, setSubmittedAt] = useState(initialSubmitted)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [idFile, setIdFile] = useState<File | null>(null)
  const [step, setStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Preview URLs live only as long as the chosen file, then are released
  const selfieUrl = useMemo(() => (selfie ? URL.createObjectURL(selfie) : null), [selfie])
  const idUrl = useMemo(() => (idFile ? URL.createObjectURL(idFile) : null), [idFile])
  useEffect(() => () => { if (selfieUrl) URL.revokeObjectURL(selfieUrl) }, [selfieUrl])
  useEffect(() => () => { if (idUrl) URL.revokeObjectURL(idUrl) }, [idUrl])

  function pick(kind: Kind, file?: File) {
    if (!file) return
    if (!EXT[file.type]) return setError('Please use a JPG, PNG or WebP photo')
    if (file.size > MAX_SIZE) return setError('Each photo must be under 5MB')
    setError(null)
    if (kind === 'selfie') setSelfie(file)
    else setIdFile(file)
  }

  async function submit() {
    if (!selfie || !idFile) return setError('Please add both photos before submitting')
    setError(null)
    try {
      const stamp = Date.now()
      // The user id must be the first folder: the storage rule and submit_kyc both check it
      const selfiePath = `${userId}/selfie-${stamp}.${EXT[selfie.type]}`
      const idPath = `${userId}/id-${stamp}.${EXT[idFile.type]}`

      setStep('Uploading your selfie')
      const a = await supabase.storage.from('kyc-documents').upload(selfiePath, selfie, { contentType: selfie.type })
      if (a.error) throw new Error(`Selfie upload failed: ${a.error.message}`)

      setStep('Uploading your school ID')
      const b = await supabase.storage.from('kyc-documents').upload(idPath, idFile, { contentType: idFile.type })
      if (b.error) throw new Error(`ID upload failed: ${b.error.message}`)

      setStep('Submitting for review')
      const { error: rpcErr } = await supabase.rpc('submit_kyc', { p_selfie_path: selfiePath, p_id_path: idPath })
      if (rpcErr) throw new Error(rpcErr.message)

      setStatus('pending')
      setSubmittedAt(new Date().toISOString())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setStep(null)
    }
  }

  const isVerified = verified || status === 'approved'
  const isPending = status === 'pending'
  const isRejected = status === 'rejected'
  const busy = step !== null

  return (
    <main className="vf-page">
      <style>{css}</style>

      <header className="vf-head">
        <h1>Verify your identity</h1>
        <p>Verified stores earn a trust badge that helps buyers feel safe ordering from you.</p>
      </header>

      {isVerified && (
        <section className="vf-banner is-ok" aria-label="Verification status">
          <ShieldCheck size={22} aria-hidden />
          <div>
            <h2>You are verified</h2>
            <p>Your store carries the trust badge. There is nothing more to do here.</p>
            <Link href="/vendor/settings" className="vf-btn-ghost">Back to settings</Link>
          </div>
        </section>
      )}

      {!isVerified && isPending && (
        <section className="vf-banner" aria-label="Verification status">
          <Clock size={22} aria-hidden />
          <div>
            <h2>Under review</h2>
            <p>
              You submitted your documents{submittedAt ? ` on ${fmtDate(submittedAt)}` : ''}. This page will show the
              result once the review is done.
            </p>
            <Link href="/vendor/settings" className="vf-btn-ghost">Back to settings</Link>
          </div>
        </section>
      )}

      {!isVerified && !isPending && (
        <>
          {isRejected && (
            <section className="vf-banner is-bad" role="alert">
              <ShieldAlert size={22} aria-hidden />
              <div>
                <h2>Your last submission was not approved</h2>
                <p>{reason || 'The photos could not be accepted.'} Please upload new photos below.</p>
              </div>
            </section>
          )}

          <section className="vf-card" aria-labelledby="vf-upload-title">
            <h2 id="vf-upload-title" className="vf-title">Upload two photos</h2>

            <div className="vf-tiles">
              <div>
                <label className={`vf-tile ${selfieUrl ? 'has-file' : ''}`}>
                  {selfieUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selfieUrl} alt="Your selfie preview" />
                  ) : (
                    <span className="vf-empty">
                      <Camera size={26} strokeWidth={1.5} aria-hidden />
                      <strong>Selfie</strong>
                      <em>Tap to take or choose a photo</em>
                    </span>
                  )}
                  <input
                    className="vf-sr"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    disabled={busy}
                    onChange={(e) => { pick('selfie', e.target.files?.[0]); e.target.value = '' }}
                  />
                </label>
                {selfie && (
                  <button className="vf-remove" onClick={() => setSelfie(null)} disabled={busy}>
                    <X size={14} aria-hidden /> Remove selfie
                  </button>
                )}
              </div>

              <div>
                <label className={`vf-tile ${idUrl ? 'has-file' : ''}`}>
                  {idUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={idUrl} alt="Your school ID preview" />
                  ) : (
                    <span className="vf-empty">
                      <Contact size={26} strokeWidth={1.5} aria-hidden />
                      <strong>School ID card</strong>
                      <em>Tap to choose a photo</em>
                    </span>
                  )}
                  <input
                    className="vf-sr"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(e) => { pick('id', e.target.files?.[0]); e.target.value = '' }}
                  />
                </label>
                {idFile && (
                  <button className="vf-remove" onClick={() => setIdFile(null)} disabled={busy}>
                    <X size={14} aria-hidden /> Remove ID
                  </button>
                )}
              </div>
            </div>

            <ul className="vf-tips">
              <li><CheckCircle2 size={15} aria-hidden /> Selfie: your face clearly visible, in good light, no sunglasses.</li>
              <li><CheckCircle2 size={15} aria-hidden /> School ID: all four corners in the frame and the text readable.</li>
              <li><CheckCircle2 size={15} aria-hidden /> JPG, PNG or WebP, up to 5MB each.</li>
            </ul>

            <div className="vf-privacy">
              <Lock size={15} aria-hidden />
              <span>Your photos are private. They are kept in a protected folder and are never shown to buyers.</span>
            </div>

            {error && (
              <div className="vf-err" role="alert">
                <AlertCircle size={16} aria-hidden /> {error}
              </div>
            )}

            <button className="vf-btn" onClick={submit} disabled={busy || !selfie || !idFile}>
              {busy && <Loader2 size={16} className="vf-spin" aria-hidden />}
              {busy ? step : isRejected ? 'Resubmit for review' : 'Submit for review'}
            </button>
          </section>
        </>
      )}
    </main>
  )
}

const css = `
.vf-page{max-width:680px;margin:0 auto;padding:32px 20px 96px;color:var(--text-primary,#e6ecff);font-family:'DM Sans',sans-serif}
.vf-head h1{font-family:'Sora',sans-serif;font-size:1.75rem;font-weight:700;letter-spacing:-.02em;margin:0 0 6px}
.vf-head p{margin:0 0 24px;opacity:.7;font-size:.95rem;max-width:56ch}
.vf-banner{display:flex;gap:14px;align-items:flex-start;padding:18px;margin-bottom:16px;background:#0f1a35;border:1px solid #1e3a5f;border-radius:16px;color:#e6ecff}
.vf-banner>svg{flex:none;color:#7fb0ff;margin-top:2px}
.vf-banner h2{margin:0 0 4px;font-family:'Sora',sans-serif;font-size:1rem}
.vf-banner p{margin:0 0 12px;font-size:.88rem;opacity:.78;line-height:1.5}
.vf-banner.is-ok{border-color:#14532d}
.vf-banner.is-ok>svg{color:#7ee2a8}
.vf-banner.is-bad{border-color:#b42318}
.vf-banner.is-bad>svg{color:#ffb4ab}
.vf-card{background:#0f1a35;border:1px solid #1e3a5f;border-radius:16px;padding:20px;color:#e6ecff;min-width:0}
.vf-title{margin:0 0 16px;font-family:'Sora',sans-serif;font-size:1rem;font-weight:600}
.vf-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:18px}
.vf-tile{position:relative;display:block;aspect-ratio:4/3;border:1.5px dashed #2c4f80;border-radius:14px;background:#0b1530;overflow:hidden;cursor:pointer;transition:border-color .15s,background .15s}
.vf-tile:hover{border-color:#2563eb;background:#0e1b3a}
.vf-tile:focus-within{outline:2px solid #2563eb;outline-offset:2px}
.vf-tile.has-file{border-style:solid;border-color:#1e3a5f}
.vf-tile img{width:100%;height:100%;object-fit:cover;display:block}
.vf-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:10px;text-align:center;color:#8fb1e8}
.vf-empty strong{color:#e6ecff;font-size:.9rem}
.vf-empty em{font-style:normal;font-size:.75rem;opacity:.75}
.vf-sr{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.vf-remove{display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:4px 0;background:none;border:0;color:#7fb0ff;font:inherit;font-size:.8rem;cursor:pointer;text-decoration:underline}
.vf-tips{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:8px}
.vf-tips li{display:flex;gap:8px;align-items:flex-start;font-size:.85rem;opacity:.85;line-height:1.45}
.vf-tips svg{flex:none;margin-top:2px;color:#7ee2a8}
.vf-privacy{display:flex;gap:8px;align-items:flex-start;padding:12px 14px;margin-bottom:16px;border-radius:10px;background:#0b1530;border:1px solid #1e3a5f;font-size:.82rem;opacity:.9;line-height:1.45}
.vf-privacy svg{flex:none;margin-top:2px;color:#7fb0ff}
.vf-err{display:flex;gap:8px;align-items:flex-start;margin-bottom:14px;padding:12px 14px;border-radius:10px;background:#3a1212;border:1px solid #7a2222;color:#ffd5d5;font-size:.86rem}
.vf-err svg{flex:none;margin-top:2px}
.vf-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 18px;background:#2563eb;color:#fff;border:0;border-radius:12px;font:inherit;font-weight:600;font-size:.95rem;cursor:pointer;transition:background .15s}
.vf-btn:hover:not(:disabled){background:#1d4ed8}
.vf-btn:disabled{opacity:.45;cursor:not-allowed}
.vf-btn:focus-visible,.vf-btn-ghost:focus-visible,.vf-remove:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.vf-btn-ghost{display:inline-flex;padding:9px 14px;border:1px solid #1e3a5f;border-radius:10px;color:#cfe0ff;font-size:.86rem;font-weight:600;text-decoration:none}
.vf-btn-ghost:hover{background:#142347;border-color:#2563eb}
.vf-spin{animation:vf-spin .8s linear infinite}
@keyframes vf-spin{to{transform:rotate(360deg)}}
@media(max-width:480px){.vf-page{padding:20px 0 96px}.vf-card,.vf-banner{padding:16px}.vf-tiles{gap:10px}.vf-empty strong{font-size:.82rem}.vf-empty em{font-size:.7rem}}
@media(prefers-reduced-motion:reduce){.vf-spin{animation:none}.vf-tile,.vf-btn{transition:none}}
`