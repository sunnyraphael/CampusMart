'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/admin/verifications', label: 'Verifications', ready: true },
  { href: '/admin/disputes', label: 'Disputes', ready: true },
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
.an{display:flex;gap:4px;padding:3px;background:#070d1f;border:1px solid #1e3a5f;border-radius:10px}
.an-tab{padding:7px 14px;border-radius:8px;color:#cfe0ff;font-size:.85rem;font-weight:500;text-decoration:none;opacity:.75}
.an-tab:hover{opacity:1}
.an-tab.is-active{background:#2563eb;color:#fff;opacity:1}
.an-tab.is-off{opacity:.4;cursor:not-allowed}
.an-tab:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
`