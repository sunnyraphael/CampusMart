'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useBuyerAccount } from '@/components/buyer/BuyerAccount'
import SearchForm from './SearchForm'
import { Home, LayoutGrid, List, ShoppingBag, Zap, HelpCircle, User, Store, Heart, MessageCircle } from 'lucide-react'

const tabs = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Categories', href: '/categories', icon: LayoutGrid },
  { label: 'Listings', href: '/products', icon: List },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Deals', href: '/deals', icon: Zap },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Favorites', href: '/wishlist', icon: Heart },
  { label: 'Messages', href: '/messages', icon: MessageCircle },
  { label: 'Help', href: '/help', icon: HelpCircle },
]

export function MobileTabBar() {
  const pathname = usePathname()
  const { vendorState } = useBuyerAccount()

  const showVendorBtn = vendorState !== 'loading'
  const vendorBtn = vendorState === 'active'
    ? { label: 'Dashboard', href: '/vendor/dashboard' }
    : vendorState === 'onboarding'
    ? { label: 'My Store', href: '/vendor/onboarding' }
    : { label: 'Sell', href: '/start-selling' }

  return (
    <div className="xl:hidden sticky top-16 z-40"
      style={{ background: 'var(--navbar-bg)', borderBottom: '1px solid var(--navbar-border)' }}>

      {/* Mobile search bar */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--navbar-border)' }}>
        <SearchForm />
      </div>

      {/* Scrollable tab strip */}
      <div className="flex items-center overflow-x-auto scrollbar-hide px-2 gap-1 h-11">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={`relative flex items-center gap-1.5 px-3 h-full shrink-0 text-xs font-semibold transition-colors
                ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
              <Icon size={14} strokeWidth={active ? 2.5 : 2}
                className={active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} />
              {label}
              {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
            </Link>
          )
        })}

        {/* Vendor tab — hidden for buyers */}
        {showVendorBtn && (
          <Link href={vendorBtn.href}
            className="relative flex items-center gap-1.5 px-3 h-full shrink-0 text-xs font-semibold
              text-blue-600 dark:text-blue-400 border-l border-gray-200 dark:border-[#1e3a5f] ml-1 pl-4">
            <Store size={14} strokeWidth={2} />
            {vendorBtn.label}
          </Link>
        )}
      </div>
    </div>
  )
}
