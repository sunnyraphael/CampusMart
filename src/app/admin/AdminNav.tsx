'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/admin/deliveries', label: 'Deliveries', ready: true },
  { href: '/admin/verifications', label: 'Verifications', ready: true },
  { href: '/admin/disputes', label: 'Disputes', ready: true },
  { href: '/admin/support', label: 'Support', ready: true },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="an" aria-label="Admin sections">
      <style>{css}</style>
      {tabs.map((t) =>
        t.ready ? (
          <Link
            key={t.href}
            href={t.href}
            className={`an-tab ${pathname.startsWith(t.href) ? 'is-active' : ''}`}
            aria-current={pathname.startsWith(t.href) ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ) : (
          <span key={t.href} className="an-tab is-off" aria-disabled="true">
            {t.label} (soon)
          </span>
        )
      )}
    </nav>
  )
}

const css = `
.an{display:flex;flex-wrap:wrap;gap:4px;padding:3px;background:var(--vx-card);border:1px solid var(--vx-border);border-radius:10px}
.an-tab{padding:7px 14px;border-radius:8px;color:var(--vx-text);font-size:.85rem;font-weight:500;text-decoration:none;opacity:.85}
.an-tab:hover{opacity:1}
.an-tab.is-active{background:#2563eb;color:#fff;opacity:1}
.an-tab.is-off{opacity:.4;cursor:not-allowed}
.an-tab:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
`
