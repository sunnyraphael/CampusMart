import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Package } from 'lucide-react'

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="vx-page-heading"><div>{eyebrow && <p className="vx-eyebrow">{eyebrow}</p>}<h1>{title}</h1><p>{description}</p></div>{actions && <div className="vx-actions">{actions}</div>}</header>
}
export function Panel({ title, description, href, children, className = '' }: { title: string; description?: string; href?: string; children: ReactNode; className?: string }) {
  return <section className={`vx-panel ${className}`}><header className="vx-panel-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{href && <Link href={href} className="vx-text-link">View all <ArrowUpRight size={15} /></Link>}</header>{children}</section>
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="vx-empty"><span className="vx-empty-icon"><Package size={26} strokeWidth={1.5} /></span><h3>{title}</h3><p>{children}</p>{action}</div>
}
