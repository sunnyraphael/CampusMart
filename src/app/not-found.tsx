import Link from 'next/link'

export default function NotFound() {
  return <main className="buyer-empty buyer-standalone"><h1>Page not found</h1><p>This link may be out of date, or the listing may no longer be available.</p><Link href="/products" className="buyer-btn is-primary">Browse listings</Link><Link href="/">Back to CampusMart</Link></main>
}
