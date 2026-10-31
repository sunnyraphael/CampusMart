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
import { PageHeading } from '@/components/vendor/Workspace'

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
    <div className="vf-page">


      <PageHeading eyebrow="A store they can trust" title="Verify your identity" description="Help buyers feel confident. Submit your documents for a store trust badge." />
      <div className="vx-verification-steps" aria-label="Verification process"><span><Camera size={17} />1. Add your photos</span><span><Clock size={17} />2. Submit for review</span><span><ShieldCheck size={17} />3. Earn your badge</span></div>

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
    </div>
  )
}
