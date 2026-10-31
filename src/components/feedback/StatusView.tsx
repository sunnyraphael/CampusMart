import type { ReactNode } from 'react'
import { CloudOff, PackageSearch, ShieldAlert, Unplug } from 'lucide-react'

export type StatusKind = 'error' | 'offline' | 'not-found' | 'data' | 'connection'
const messages = {
  error: { eyebrow: 'A small interruption', title: 'This page could not load', description: 'Something interrupted this page. Try again, or head back to somewhere familiar.', code: 'PAGE ERROR', icon: Unplug },
  offline: { eyebrow: 'We’ll be here', title: 'You’re offline', description: 'Check your Wi-Fi or mobile data. Your open page will return when your connection is back.', code: 'OFFLINE', icon: CloudOff },
  'not-found': { eyebrow: 'A different direction', title: 'Page not found', description: 'This link may be out of date, or the item may no longer be available. There’s more to discover on CampusMart.', code: '404', icon: PackageSearch },
  data: { eyebrow: 'Please try again', title: 'We could not load this information.', description: 'We couldn’t get the latest details. Try again in a moment, or contact support if it keeps happening.', code: 'TRY AGAIN', icon: ShieldAlert },
  connection: { eyebrow: 'Let’s reconnect', title: 'We can’t reach CampusMart', description: 'Your connection may be interrupted, or CampusMart may be temporarily unavailable. Please try again in a moment.', code: 'CONNECTION', icon: Unplug },
}

export default function StatusView({ kind = 'error', title, description, actions, compact = false, reference, note }: { kind?: StatusKind; title?: string; description?: string; actions?: ReactNode; compact?: boolean; reference?: string; note?: ReactNode }) {
  const content = messages[kind], Icon = content.icon
  const Heading = compact ? 'h2' : 'h1'
  return <section className={`cm-status${compact ? ' compact' : ''}`} role={kind === 'not-found' ? undefined : 'alert'} data-status-kind={kind}>
    <p className="cm-status-brand">Campus<span>Mart</span></p><div className="cm-status-art" aria-hidden="true"><span className="cm-status-orbit" /><span className="cm-status-symbol"><Icon strokeWidth={1.5} /></span><span className="cm-status-code">{content.code}</span></div>
    <p className="cm-status-eyebrow">{content.eyebrow}</p><Heading>{title ?? content.title}</Heading><p className="cm-status-description">{description ?? content.description}</p>{actions && <div className="cm-status-actions">{actions}</div>}{note && <p className="cm-status-foot">{note}</p>}{reference && <p className="cm-status-reference">Support reference: {reference}</p>}
  </section>
}
