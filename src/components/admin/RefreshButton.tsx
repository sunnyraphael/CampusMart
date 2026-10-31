'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function AdminRefresh() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button className="buyer-btn" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw size={16} aria-hidden />{pending ? 'Refreshing…' : 'Refresh'}</button>
}
