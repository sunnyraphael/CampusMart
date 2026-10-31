'use client'

import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { trackingDate } from '@/lib/orders/tracking'

export default function BuyerDeliveryCode({ itemId, verified }: { itemId: string; verified: boolean }) {
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!code) return
    const timer = setTimeout(() => setExpired(true), Math.max(0, new Date(code.expires_at).getTime() - Date.now()))
    return () => clearTimeout(timer)
  }, [code])
  async function generate() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const { data, error } = await createClient().rpc('cm_issue_delivery_code', { p_item_id: itemId })
      if (error) { setError(error.message); return }
      if (!data?.code || !data?.expires_at) { setError('The code could not be generated. Try again.'); return }
      setCode(data); setExpired(false)
    } catch { setError('Check your connection and try again.') } finally { setBusy(false) }
  }
  if (verified) return null
  return <div className="ot-code-panel">
    <h4><KeyRound size={17} aria-hidden />Your private delivery code</h4>
    <p>Generate this when you meet the vendor or rider. Share it only after receiving and checking this item. Each item has its own code.</p>
    {code && <div aria-live="polite">{expired ? <p>This code has expired. Generate a replacement.</p> : <><output className="ot-code" aria-label="Your delivery code">{code.code}</output><p className="buyer-help">Valid until {trackingDate(code.expires_at)}. A replacement cancels the previous code.</p></>}</div>}
    <button className="buyer-btn" disabled={busy} onClick={generate}>{busy ? 'Generating…' : code ? 'Generate replacement code' : 'Generate delivery code'}</button>
    {error && <p className="ot-error" role="alert">{error}</p>}
  </div>
}
