import Link from 'next/link'
import StatusView from '@/components/feedback/StatusView'

export default function NotFound() {
  return <main className="cm-status-full"><StatusView kind="not-found" actions={<><Link href="/products" className="cm-status-btn">Browse listings</Link><Link href="/" className="cm-status-btn secondary">Back to CampusMart</Link></>} /></main>
}
