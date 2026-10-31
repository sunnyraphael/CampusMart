'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { removeSavedSearch } from '@/lib/buyer/actions'

export default function SavedSearchRemove({ id }: { id: string }) {
  const [busy,setBusy] = useState(false)
  return <button className="buyer-btn" disabled={busy} onClick={async () => { setBusy(true); try { const r=await removeSavedSearch(id); if ('error' in r) toast.error(r.error) } catch { toast.error('Could not remove search.') } finally { setBusy(false) } }}>Remove</button>
}
