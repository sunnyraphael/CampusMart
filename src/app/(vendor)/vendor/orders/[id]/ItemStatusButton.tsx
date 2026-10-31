'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ItemStatusButton({
  itemId,
  to,
  label,
}: {
  itemId: string
  to: string
  label: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [refreshing, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function go() {
    if (busy || refreshing) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: rpcError } = await supabase.rpc('vendor_update_item_status', {
      p_item_id: itemId,
      p_new_status: to,
    })
      if (rpcError) setError(rpcError.message)
      else startTransition(() => router.refresh())
    } catch { setError('The order could not be updated. Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={busy || refreshing}
        className="vx-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          background: '#2563eb',
          color: '#fff',
          border: 0,
          borderRadius: 10,
          font: 'inherit',
          fontWeight: 600,
          fontSize: '.875rem',
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? <Loader2 size={15} className="od-spin" aria-hidden /> : <Truck size={15} aria-hidden />}
        {label}
      </button>
      {error && <p role="alert" style={{ color: 'var(--vx-err)', fontSize: '.8rem', margin: '8px 0 0' }}>{error}</p>}
    </div>
  )
}
