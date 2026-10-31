'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function RetryListingsButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button type="button" className="buyer-btn" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw size={15} aria-hidden="true" className={pending ? 'animate-spin' : undefined} />{pending ? 'Loading listings…' : 'Retry listings'}</button>
}
