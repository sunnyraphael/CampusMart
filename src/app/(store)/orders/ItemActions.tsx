'use client'
import ReceiptReview,{type ReviewPurchase} from '@/components/orders/ReceiptReview'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'idle' | 'confirm' | 'dispute'

export default function ItemActions({ itemId, status, credited = false, review }: { itemId: string; status: string; credited?: boolean;review?:ReviewPurchase }) {
  const router = useRouter()
  const [justReceived,setJustReceived]=useState(false)
  const [mode, setMode] = useState<Mode>('idle')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, startTransition] = useTransition()
  const [error, setError] = useState('')
  const canReceive = !credited && !justReceived && ['shipped', 'delivered'].includes(status)
  const canDispute = !credited && ['shipped', 'delivered', 'received'].includes(status)
  const locked = busy || refreshing
  const showReview=!!review&&(status==='received'||justReceived&&['shipped','delivered'].includes(status))
  if (!canReceive && !canDispute && !showReview) return null

  async function submit(kind: 'received' | 'dispute') {
    if (locked) return
    if (kind === 'dispute' && reason.trim().length < 5) {
      setError('Please describe the problem in at least 5 characters.')
      return
    }
    setBusy(true); setError('')
    try {
      const supabase = createClient()
      const { error } = kind === 'received'
        ? await supabase.rpc('cm_confirm_delivery', { p_item_id: itemId })
        : await supabase.rpc('cm_report_order_problem', { p_item_id: itemId, p_reason: reason.trim() })
      if (error) { setError(error.message); return }
      if(kind==='received')setJustReceived(true)
      setMode('idle')
      startTransition(() => router.refresh())
    } catch { setError('Check your connection and try again.') } finally { setBusy(false) }
  }

  function cancel() { setMode('idle'); setError('') }
  return <div className="ot-buyer-actions">
    {showReview&&review&&<ReceiptReview purchase={review} autoOpen={justReceived&&!review.existing}/>}
    {mode === 'idle' && <div className="buyer-actions">
      {canReceive && <button className="buyer-btn is-primary" onClick={() => { setMode('confirm'); setError('') }}><CheckCircle2 size={16} aria-hidden />I received this</button>}
      {canDispute && <button className="buyer-btn is-danger" onClick={() => { setMode('dispute'); setError('') }}><ShieldAlert size={16} aria-hidden />Report a problem</button>}
    </div>}
    {mode === 'confirm' && <div className="ot-code-panel">
      <p>Only confirm if the item is in your hands and as described. This sends your confirmation to admin for review. It does not release money to the vendor.</p>
      <div className="buyer-actions"><button className="buyer-btn is-primary" disabled={locked} onClick={() => submit('received')}>{busy ? 'Saving...' : 'Confirm receipt'}</button><button className="buyer-btn" disabled={locked} onClick={cancel}>Cancel</button></div>
    </div>}
    {mode === 'dispute' && <form className="ot-code-panel ot-form" onSubmit={e => { e.preventDefault(); void submit('dispute') }}>
      <p>Tell us what went wrong. Vendor credit stays on hold while admin reviews your report.</p>
      <label htmlFor={`problem-${itemId}`}>Describe the problem<textarea id={`problem-${itemId}`} value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: the item never arrived, or it is not what was listed" rows={3} maxLength={1000} minLength={5} required /></label>
      <div className="buyer-actions"><button className="buyer-btn is-danger" disabled={locked}>{busy ? 'Saving...' : 'Submit dispute'}</button><button type="button" className="buyer-btn" disabled={locked} onClick={cancel}>Cancel</button></div>
    </form>}
    {error && <p className="ot-error" role="alert">{error}</p>}
  </div>
}
