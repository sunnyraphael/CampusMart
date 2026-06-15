export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      {/* Minimal header — logo only, no navbar */}
      <header style={{
        borderBottom: '1px solid var(--navbar-border)',
        background: 'var(--navbar-bg)',
        padding: '16px 24px',
      }}>
        <a href="/" style={{
          fontFamily: 'var(--font-sora)',
          fontWeight: 700,
          fontSize: '1.25rem',
          color: 'var(--primary, #2563eb)',
          textDecoration: 'none',
        }}>
          CampusMart
        </a>
      </header>

      <main className="max-w-screen-lg mx-auto px-4 py-8 md:px-6">
        {children}
      </main>
    </div>
  )
}