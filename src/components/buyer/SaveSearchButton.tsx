'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { saveSearch } from '@/lib/buyer/actions'
import { createClient } from '@/lib/supabase/client'
import type { SortKey } from '@/lib/products-query'

export default function SaveSearchButton({ query, category, sort }: { query: string; category: string; sort: SortKey }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  async function save() {
    setBusy(true)
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) { router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
      const result = await saveSearch({ name: (query || category || 'All listings').slice(0, 100), query, category, sort })
      if ('error' in result) toast.error(result.error)
      else toast.success('Search saved. Find it under Saved searches in your profile.')
    } catch { toast.error('Could not save your search. Please try again.') }
    finally { setBusy(false) }
  }
  return <button className="buyer-btn" onClick={save} disabled={busy}><Bookmark size={16} aria-hidden="true" />{busy ? 'Saving…' : 'Save search'}</button>
}
