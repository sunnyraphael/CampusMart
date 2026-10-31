'use client'

import StatusView from '@/components/feedback/StatusView'
import type { PageErrorProps } from '@/components/feedback/RecoveryScreen'
import '../../public/status.css'

export default function GlobalError({ error, unstable_retry, reset }: PageErrorProps) {
  // eslint-disable-next-line @next/next/no-html-link-for-pages -- A root-layout failure needs a fresh document, without reusing the broken layout.
  return <html lang="en"><head><title>Let’s try that again · CampusMart</title></head><body className="cm-static-body"><main className="cm-status-full"><StatusView kind="error" reference={error.digest} actions={<><button className="cm-status-btn" onClick={() => (unstable_retry ?? reset)()}>Try again</button><a className="cm-status-btn secondary" href="/">Back to CampusMart</a></>} /></main></body></html>
}
