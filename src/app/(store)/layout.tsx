import { Navbar } from '@/components/layout/Navbar'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Footer } from '@/components/layout/Footer'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <Navbar />
      <MobileTabBar />
      <main className="max-w-screen-2xl mx-auto px-4 py-6 md:px-6">
        {children}
      </main>
      <Footer />
    </div>
  )
}