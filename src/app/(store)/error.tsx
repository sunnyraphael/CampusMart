'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function BuyerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Buyer page failed', error) }, [error])
  return <section className="buyer-empty" role="alert"><h1>This page could not load</h1><p>Your information has not been changed. Please try again.</p><div className="buyer-actions"><button className="buyer-btn is-primary" onClick={reset}>Try again</button><Link className="buyer-btn" href="/help">Get help</Link></div></section>
}
