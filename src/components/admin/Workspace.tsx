import type { ReactNode } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'

export function AdminHeading({ eyebrow = 'Review queue', title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="aw-heading"><div><p className="aw-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="aw-description">{description}</p></div>{actions && <div className="buyer-actions">{actions}</div>}</header>
}
export function QueueToolbar({ query, onQuery, placeholder, children, count }: { query: string; onQuery: (value: string) => void; placeholder: string; children?: ReactNode; count: string }) {
  return <div className="aw-toolbar"><label className="aw-search"><Search size={17} aria-hidden /><input type="search" aria-label={placeholder} placeholder={placeholder} value={query} onChange={e => onQuery(e.target.value)} /></label>{children && <div className="aw-filter"><SlidersHorizontal size={16} aria-hidden />{children}</div>}<span className="aw-result-count" role="status">{count}</span></div>
}
export function QueueSummary({ items }: { items: { label: string; value: ReactNode; detail?: string }[] }) {
  return <div className="aw-queue-summary">{items.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.detail && <small>{item.detail}</small>}</div>)}</div>
}
