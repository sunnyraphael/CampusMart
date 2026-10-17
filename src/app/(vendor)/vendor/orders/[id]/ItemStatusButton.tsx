'use client'

import { useState } from 'react'
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
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('vendor_update_item_status', {
      p_item_id: itemId,
      p_new_status: to,
    })
    if (rpcError) setError(rpcError.message)
    else router.refresh() // re-runs the server page so it shows the new status
    setBusy(false)
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={busy}
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
      {error && <p style={{ color: '#ffb4ab', fontSize: '.8rem', margin: '8px 0 0' }}>{error}</p>}
    </div>
  )
}