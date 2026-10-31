import Link from 'next/link'
import { EmptyState } from '@/components/vendor/Workspace'
export default function VendorNotFound() {
  return <section className="vx-panel"><EmptyState title="This page is unavailable" action={<Link className="vx-btn" href="/vendor/dashboard">Back to overview</Link>}>The listing, order, or conversation may have been removed, or you may not have access to it.</EmptyState></section>
}
