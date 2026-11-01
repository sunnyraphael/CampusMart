import { Navbar } from '@/components/layout/Navbar'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { Footer } from '@/components/layout/Footer'
import { BuyerAccount } from '@/components/buyer/BuyerAccount'
import BuyerWorkspace from '@/components/buyer/BuyerWorkspace'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <BuyerAccount><div className="buyer-site min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <Navbar />
      <MobileTabBar />
      <main className="max-w-screen-2xl mx-auto px-4 py-6 md:px-6">
        <BuyerWorkspace>{children}</BuyerWorkspace>
      </main>
      <Footer />
    </div></BuyerAccount>
  )
}
