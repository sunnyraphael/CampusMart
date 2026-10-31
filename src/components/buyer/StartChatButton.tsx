'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { startConversation } from '@/lib/buyer/actions'
import { createClient } from '@/lib/supabase/client'

export default function StartChatButton({ vendorId, productId }: { vendorId: string; productId?: string }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  async function open() {
    setBusy(true)
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) { router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`); return }
      const result = await startConversation(vendorId, productId)
      if ('error' in result) toast.error(result.error)
      else router.push(`/messages/${result.id}`)
    } catch { toast.error('Could not open this conversation. Please try again.') }
    finally { setBusy(false) }
  }
  return <button className="buyer-btn" onClick={open} disabled={busy}><MessageCircle size={16} aria-hidden="true" />{busy ? 'Opening…' : 'Message vendor'}</button>
}
