import type { Metadata } from 'next'
import { Sora, DM_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import ConnectionGuard from '@/components/feedback/ConnectionGuard'
import CookieConsent from '@/components/privacy/CookieConsent'
import '../../public/status.css'
import './globals.css'
import './buyer.css'
import './store-layouts.css'
import './skeletons.css'
import './order-tracking.css'
import './buyer-shopping.css'
import './buyer-workspace.css'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  icons: {icon:'/brand/campusmart-symbol.png',apple:'/brand/campusmart-symbol.png'},
  title: 'CampusMart - Student Marketplace',
  description: 'Buy, sell and connect with students on campus.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${sora.variable} ${dmSans.variable} font-sans antialiased`}>
        <ThemeProvider>
          <ConnectionGuard>{children}<CookieConsent/><Toaster richColors position="top-right" /></ConnectionGuard>
        </ThemeProvider>
      </body>
    </html>
  )
}
