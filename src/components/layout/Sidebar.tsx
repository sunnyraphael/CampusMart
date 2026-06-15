'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, LayoutGrid, List, ShoppingBag, Tag,
  Bookmark, Zap, HelpCircle
} from 'lucide-react'

const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Categories', href: '/categories', icon: LayoutGrid },
  { label: 'All Listings', href: '/products', icon: List },
  { label: 'My Orders', href: '/orders', icon: ShoppingBag },
  { label: 'My Listings', href: '/vendor/listings', icon: Tag },
  { label: 'Saved Searches', href: '/saved', icon: Bookmark },
  { label: 'Campus Deals', href: '/deals', icon: Zap, badge: 'New' },
  { label: 'Help Center', href: '/help', icon: HelpCircle },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0
      border-r border-gray-200 dark:border-gray-800
      bg-white dark:bg-gray-950
      sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto
      pt-4 pb-8 px-3">
      <nav className="flex flex-col gap-0.5">
        {navItems.map(({ label, href, icon: Icon, badge }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${active
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
            >
              <Icon
                size={18}
                className={active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}
              />
              <span>{label}</span>
              {badge && (
                <span className="ml-auto text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
