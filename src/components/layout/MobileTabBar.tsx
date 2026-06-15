'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutGrid, List, ShoppingBag, Zap, HelpCircle, User, Search } from 'lucide-react'

const tabs = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Categories', href: '/categories', icon: LayoutGrid },
  { label: 'Listings', href: '/products', icon: List },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Deals', href: '/deals', icon: Zap },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Help', href: '/help', icon: HelpCircle },
]

export function MobileTabBar() {
  const pathname = usePathname()

  return (
    /* Only shows on mobile (md and below), sits just below the top Navbar */
    <div className="md:hidden sticky top-16 z-40
      backdrop-blur-sm
      border-b border-gray-100 dark:border-[#1e3a5f]">
    <div className="md:hidden sticky top-16 z-40 backdrop-blur-sm"
      style={{ background: 'var(--navbar-bg)', borderBottom: '1px solid var(--navbar-border)' }}>
      </div>

      {/* Mobile search bar */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-[#1e3a5f]">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search for products or sellers..."
            className="w-full pl-9 pr-4 py-2 rounded-full text-sm
              bg-white dark:bg-gray-800
              border border-transparent focus:border-blue-400 dark:focus:border-blue-500
              text-gray-900 dark:text-gray-100
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              outline-none transition-all"
          />
        </div>
      </div>

      {/* Scrollable tab strip */}
      <div className="flex items-center overflow-x-auto scrollbar-hide px-2 gap-1 h-11">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-1.5 px-3 h-full shrink-0 text-xs font-semibold transition-colors
                ${active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
                }`}
            >
              <Icon
                size={14}
                className={active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}
                strokeWidth={active ? 2.5 : 2}
              />
              {label}
              {/* Active underline */}
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
