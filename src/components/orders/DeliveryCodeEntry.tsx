'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OrderTracking } from '@/lib/orders/tracking'

type Check = 'loading' | 'ready' | 'verified' | 'locked' | 'error'
export default function DeliveryCodeEntry({ itemId, orderId, focusSignal = 0, reported = false, disabled = false, onVerified, onBusyChange }: {
  itemId: string; orderId?: string; focusSignal?: number; reported?: boolean; disabled?: boolean
  onVerified?: () => void; onBusyChange?: (busy: boolean) => void
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [check, setCheck] = useState<Check>(orderId ? 'loading' : 'ready')
  const [attempt, setAttempt] = useState(0)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, startTransition] = useTransition()
  useEffect(() => {
    if (!orderId) return
    let active = true
    async function load() {
      try {
        const result = await createClient().rpc('cm_order_tracking', { p_order_id: orderId })
        if (!active) return
        if (result.error) { setError('Delivery verification could not load. Please try again.'); setCheck('error'); return }
        const item = (result.data as OrderTracking[] | null)?.find(t => t.item_id === itemId)
        if (!item || item.released_at || !['shipped', 'delivered', 'received'].includes(item.status)) setCheck('locked')
        else setCheck(item.code_verified_at ? 'verified' : 'ready')
      } catch { if (active) { setError('Check your connection and try again.'); setCheck('error') } }
    }
    void load()
    return () => { active = false }
  }, [itemId, orderId, attempt])
  useEffect(() => { if (focusSignal && check === 'ready' && !disabled) input.current?.focus() }, [focusSignal, check, disabled])

  async function verify() {
    if (busy || refreshing || disabled || check !== 'ready' || !/^\d{6}$/.test(code)) return
    setBusy(true); setError(''); onBusyChange?.(true)
    try {
      const result = await createClient().rpc('cm_verify_delivery_code', { p_item_id: itemId, p_code: code })
      if (result.error) { setError(result.error.message); return }
      if (result.data?.ok !== true) { setError(result.data?.message || 'The code could not be verified.'); return }
      setCode(''); setCheck('verified'); onVerified?.()
      startTransition(() => router.refresh())
    } catch { setError('The code could not be verified. Check your connection and retry.') }
    finally { setBusy(false); onBusyChange?.(false) }
  }
  if (check === 'loading') return <div className="ot-code-entry" role="status">Checking delivery verification…</div>
  if (check === 'verified') return <p className="ot-code-verified" role="status"><CheckCircle2 size={17} aria-hidden />Delivery code verified. Admin approval is still required.</p>
  if (check === 'locked') return <p className="buyer-help">This item cannot accept a delivery code in its current state. Refresh tracking to see the latest update.</p>
  if (check === 'error') return <div className="ot-code-entry"><p className="ot-error" role="alert">{error}</p><button className="buyer-btn" onClick={() => { setError(''); setCheck('loading'); setAttempt(n => n + 1) }}>Try again</button></div>
  return <form className="ot-code-entry" onSubmit={e => { e.preventDefault(); void verify() }}>
    {reported && <p className="ot-code-prompt" role="status">Delivery reported. Enter the buyer’s code here to verify the handover.</p>}
    <label htmlFor={`code-${itemId}`}><KeyRound size={16} aria-hidden />Buyer’s delivery code</label>
    <p className="buyer-help">After handing over this item, ask the buyer for their 6-digit code from Track order. Verification does not release money.</p>
    <div className="buyer-actions"><input ref={input} id={`code-${itemId}`} inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy || refreshing || disabled} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" /><button className="buyer-btn is-primary" disabled={busy || refreshing || disabled || code.length !== 6}>{busy ? 'Verifying…' : 'Verify code'}</button></div>
    {error && <p className="ot-error" role="alert">{error}</p>}
  </form>
}
