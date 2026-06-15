import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--page-bg)' }}>
      <header style={{
        borderBottom: '1px solid var(--navbar-border)',
        background: 'var(--navbar-bg)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-sora)',
          fontWeight: 700,
          fontSize: '1.25rem',
          color: '#2563eb',
          textDecoration: 'none',
        }}>
          CampusMart
        </Link>

        <Link href="/" style={{
          fontFamily: 'var(--font-dm-sans)',
          fontSize: '0.875rem',
          color: 'var(--muted-foreground, #64748b)',
          textDecoration: 'none',
        }}>
          ← Back to store
        </Link>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}