'use client'

import Link from 'next/link'
import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import StatusView from './StatusView'

export type PageErrorProps = { error: Error & { digest?: string }; reset: () => void; unstable_retry?: () => void }
export default function RecoveryScreen({ error, reset, unstable_retry, vendor = false, compact = false, message }: Partial<PageErrorProps> & { vendor?: boolean; compact?: boolean; message?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useEffect(() => { if (error) console.error('CampusMart page error', { message: error.message, reference: error.digest }) }, [error])
  function retry() { startTransition(() => { if (unstable_retry) unstable_retry(); else if (reset) { router.refresh(); reset() } else router.refresh() }) }
  return <StatusView kind={compact ? 'data' : 'error'} compact={compact} title={vendor && !compact ? 'We couldn’t load this page' : undefined} description={message} reference={error?.digest} actions={<><button className="cm-status-btn" disabled={pending} onClick={retry}><RefreshCw size={16} aria-hidden="true" />{pending ? 'Trying again…' : 'Try again'}</button><Link className="cm-status-btn secondary" href={compact ? '/contact' : vendor ? '/vendor/dashboard' : '/'}><ArrowLeft size={15} aria-hidden="true" />{compact ? 'Contact support' : vendor ? 'Back to overview' : 'Back to CampusMart'}</Link></>} note="Retrying this page won’t submit a form, place an order, or initiate a payment." />
}
