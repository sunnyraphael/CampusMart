'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Home, LayoutGrid, List, ShoppingBag, Zap, HelpCircle, User, Search, Store } from 'lucide-react'

const tabs = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Categories', href: '/categories', icon: LayoutGrid },
  { label: 'Listings', href: '/products', icon: List },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Deals', href: '/deals', icon: Zap },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Help', href: '/help', icon: HelpCircle },
]

type VendorState = 'loading' | 'none' | 'buyer' | 'onboarding' | 'active'

export function MobileTabBar() {
  const pathname = usePathname()
  const [vendorState, setVendorState] = useState<VendorState>('loading')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) { setVendorState('none'); return }

      const { data: userData } = await supabase
        .from('users').select('role').eq('id', user.id).single()

      if (!userData || userData.role === 'buyer') { setVendorState('buyer'); return }

      const { data: seller } = await supabase
        .from('sellers').select('store_name').eq('user_id', user.id).single()

      setVendorState(seller?.store_name ? 'active' : 'onboarding')
    })
  }, [])

  const showVendorBtn = vendorState === 'none' || vendorState === 'onboarding' || vendorState === 'active'
  const vendorBtn = vendorState === 'active'
    ? { label: 'Dashboard', href: '/vendor/dashboard' }
    : vendorState === 'onboarding'
    ? { label: 'My Store', href: '/vendor/onboarding' }
    : { label: 'Sell', href: '/register?role=vendor' }

  return (
    <div className="md:hidden sticky top-16 z-40"
      style={{ background: 'var(--navbar-bg)', borderBottom: '1px solid var(--navbar-border)' }}>

      {/* Mobile search bar */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--navbar-border)' }}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search for products or sellers..."
            className="w-full pl-9 pr-4 py-2 rounded-full text-sm
              bg-white dark:bg-gray-800
              border border-transparent focus:border-blue-400
              text-gray-900 dark:text-gray-100
              placeholder:text-gray-400 outline-none transition-all"
          />
        </div>
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
