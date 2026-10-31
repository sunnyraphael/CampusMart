'use client'
import Link from 'next/link'
import { AlertCircle, RotateCcw } from 'lucide-react'

export default function VendorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="vx-panel vx-empty" role="alert"><AlertCircle size={30} className="vx-muted" /><h1 style={{ fontSize: 22, marginTop: 18 }}>We couldn’t load this page</h1><p>Your store details are still saved. Try loading the page again.</p><div className="vx-actions"><button className="vx-btn" onClick={reset}><RotateCcw size={15} />Try again</button><Link className="vx-btn vx-btn-secondary" href="/vendor/dashboard">Back to overview</Link></div></section>
}
