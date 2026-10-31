import Link from 'next/link'
import { ArrowRight, PackageSearch } from 'lucide-react'
import RecoveryScreen from '@/components/feedback/RecoveryScreen'
import type { ReactNode } from 'react'

export function BuyerPage({ title, description, children, actions }: { title: string; description: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="buyer-page">
    <header className="buyer-heading"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="buyer-actions">{actions}</div>}</header>
    {children}
  </section>
}

export function EmptyState({ title, children, href = '/products', label = 'Browse listings' }: { title: string; children: ReactNode; href?: string; label?: string }) {
  return <div className="buyer-empty"><PackageSearch size={30} aria-hidden="true" /><h2>{title}</h2><p>{children}</p><Link className="buyer-btn" href={href}>{label}<ArrowRight size={16} aria-hidden="true" /></Link></div>
}

export function DataError({ message = 'Please try again. If this continues, contact support.' }: { message?: string }) {
  return <RecoveryScreen compact message={message} />
}
