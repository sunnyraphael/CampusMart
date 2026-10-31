import Link from 'next/link'
import StatusView from '@/components/feedback/StatusView'
export default function VendorNotFound() {
  return <StatusView kind="not-found" title="This page is unavailable" description="This listing, order, or conversation may have been removed, or you may not have access to it." actions={<Link className="cm-status-btn" href="/vendor/dashboard">Back to overview</Link>} />
}
