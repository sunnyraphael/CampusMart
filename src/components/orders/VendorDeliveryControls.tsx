'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Truck } from 'lucide-react'
import DeliveryCodeEntry from './DeliveryCodeEntry'
import { createClient } from '@/lib/supabase/client'
import { nextDeliveryStep, type OrderTracking } from '@/lib/orders/tracking'

export default function VendorDeliveryControls({ itemId, status, pickup, tracking: t }: { itemId: string; status: string; pickup: boolean; tracking?: OrderTracking }) {
  const router = useRouter()
  const [refreshing, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [codeFocus, setCodeFocus] = useState(0)
  const [codeBusy, setCodeBusy] = useState(false)
  const [courier, setCourier] = useState(t?.courier ?? '')
  const [number, setNumber] = useState(t?.tracking_number ?? '')
  const [url, setUrl] = useState(t?.tracking_url ?? '')
  const [note, setNote] = useState(t?.delivery_note ?? '')
  const [expected, setExpected] = useState('')
  const step = nextDeliveryStep[status]
  const locked = busy || refreshing || codeBusy
  const canEdit = ['pending', 'confirmed', 'shipped', 'delivered'].includes(status) && !t?.released_at
  const canVerify = ['shipped', 'delivered', 'received'].includes(status) && !t?.code_verified_at && !t?.released_at
  async function submit(kind: 'details' | 'advance') {
    if (locked) return
    setBusy(true); setError(''); setNotice('')
    try {
      const supabase = createClient()
      const { error } = await supabase.rpc('cm_vendor_update_delivery', { p_item_id: itemId, p_status: kind === 'advance' && step ? step.to : status,
        p_expected_by: expected ? new Date(expected).toISOString() : null, p_courier: courier, p_tracking_number: number, p_tracking_url: url, p_note: note })
      if (error) { setError(error.message); return }
      if (kind === 'advance' && step?.to === 'delivered') {
        setNotice('Delivery reported. Enter the buyer delivery code below to verify handover.')
        setCodeFocus(n => n + 1)
      } else setNotice('Delivery update saved.')
      startTransition(() => router.refresh())
    } catch { setError('The update could not be saved. Check your connection and try again.') } finally { setBusy(false) }
  }
  if (!canEdit && !canVerify) return null
  return <div className="ot-vendor-controls">
    {canEdit && <details className="ot-edit"><summary>Delivery details &amp; estimated time</summary><form className="ot-form" onSubmit={e => { e.preventDefault(); void submit('details') }}>
      <label htmlFor={`eta-${itemId}`}>Estimated {pickup ? 'pickup' : 'delivery'} time<input id={`eta-${itemId}`} type="datetime-local" value={expected} onChange={e => setExpected(e.target.value)} /><span className="buyer-help">Uses your device’s local time. Leave blank to keep the current estimate.</span></label>
      {!pickup && <><label>Courier or rider<input value={courier} onChange={e => setCourier(e.target.value)} maxLength={100} /></label><label>Tracking number<input value={number} onChange={e => setNumber(e.target.value)} maxLength={120} /></label><label>Courier tracking link<input type="url" value={url} onChange={e => setUrl(e.target.value)} maxLength={500} placeholder="https://…" /></label></>}
      <label>Instructions for the buyer<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={3} /></label>
      <button className="buyer-btn" disabled={locked}>Save delivery details</button>
    </form></details>}
    {step && <button className="buyer-btn is-primary" disabled={locked} onClick={() => submit('advance')}><Truck size={16} aria-hidden />{pickup && status === 'confirmed' ? 'Mark ready for pickup' : step.label}</button>}
    {canVerify && <DeliveryCodeEntry itemId={itemId} focusSignal={codeFocus} reported={codeFocus>0} disabled={busy || refreshing} onBusyChange={setCodeBusy} onVerified={() => setNotice('Delivery code verified. Admin approval is still required.')} />}
    {notice && <p role="status" className="buyer-help">{notice}</p>}{error && <p className="ot-error" role="alert">{error}</p>}
  </div>
}
