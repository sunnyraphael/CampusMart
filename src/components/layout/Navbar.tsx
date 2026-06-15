'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cart'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import {
  ShoppingCart, Bell, Heart, MessageCircle,
  Search, ShoppingBag, ChevronDown,
  User, Settings, LogOut, Package
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const { items } = useCartStore()
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.profile-dropdown-wrap')) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setProfileOpen(false)
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-sm"
      style={{ background: 'var(--navbar-bg, #e0eaff)', borderBottom: '1px solid var(--navbar-border, #c7d7f9)' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center h-16 px-4 gap-4 max-w-screen-2xl mx-auto">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <ShoppingBag size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-sora), Sora, sans-serif' }}>
            <span className="text-gray-900 dark:text-white" style={{ WebkitTextStroke: '0.3px #93c5fd' }}>Campus
            </span>
            <span className="text-blue-600">Mart</span>
          </span>
        </Link>

        {/* Desktop search */}
        <div className="hidden md:flex flex-1 max-w-xl mx-4">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search for items, categories or sellers"
              className="w-full pl-10 pr-4 py-2.5 rounded-full text-sm
                bg-white dark:bg-gray-800
                border border-transparent focus:border-blue-400 dark:focus:border-blue-500
                text-gray-900 dark:text-gray-100
                placeholder:text-gray-400 dark:placeholder:text-gray-500
                outline-none transition-all"
            />
          </div>
        </div>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-1 ml-auto">
          <Link href="/messages"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
              text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <MessageCircle size={18} />
            <span>Messages</span>
          </Link>
          <Link href="/wishlist"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
              text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Heart size={18} />
            <span>Favorites</span>
          </Link>
          <Link href="/notifications"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
              text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative">
            <Bell size={18} />
            <span>Notifications</span>
            <span className="absolute top-1.5 left-5 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-[#060d1f]" />
          </Link>

          <ThemeToggle />

          {/* Cart */}
          <Link href="/cart"
            className="relative w-9 h-9 flex items-center justify-center rounded-full
              hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1">
            <ShoppingCart size={20} className="text-gray-600 dark:text-gray-400" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full
                bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                {cartCount}
              </span>
            )}
          </Link>

          {/* Auth */}
          {user ? (
            <div className="relative ml-1 profile-dropdown-wrap">
              <button
                onClick={() => setProfileOpen(o => !o)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl
                  hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {user.email?.[0]?.toUpperCase() ?? 'U'}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[80px] truncate">
                  {user.user_metadata?.full_name?.split(' ')[0] ?? 'You'}
                </span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 w-48 rounded-xl border border-gray-200 dark:border-[#1e3a5f]
                  bg-white dark:bg-[#0f1a35] shadow-xl z-50 overflow-hidden py-1">
                  <Link href="/profile" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300
                      hover:bg-gray-50 dark:hover:bg-[#1e3a5f] transition-colors">
                    <User size={15} /> Profile
                  </Link>
                  <Link href="/orders" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300
                      hover:bg-gray-50 dark:hover:bg-[#1e3a5f] transition-colors">
                    <Package size={15} /> My Orders
                  </Link>
                  <Link href="/settings" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300
                      hover:bg-gray-50 dark:hover:bg-[#1e3a5f] transition-colors">
                    <Settings size={15} /> Settings
                  </Link>
                  <hr className="my-1 border-gray-100 dark:border-[#1e3a5f]" />
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500
                      hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2">
              <Link href="/login"
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                Log in
              </Link>
              <Link href="/register"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600
                  hover:bg-blue-700 rounded-xl transition-colors">
                Sign up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile right icons */}
        <div className="flex md:hidden items-center gap-1 ml-auto">
          <ThemeToggle />
          <Link href="/notifications"
            className="relative w-9 h-9 flex items-center justify-center rounded-full
              hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Bell size={20} className="text-gray-600 dark:text-gray-400" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-[#060d1f]" />
          </Link>
          <Link href="/cart"
            className="relative w-9 h-9 flex items-center justify-center rounded-full
              hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ShoppingCart size={20} className="text-gray-600 dark:text-gray-400" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full
                bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* ── Desktop second nav bar ── */}
      <div className="hidden md:block" style={{ background: 'var(--navbar-bg, #ccd9ff)', borderTop: '1px solid #c7d7f9' }}>
        <SecondNav />
      </div>
    </header>
  )
}

// Separate component so it can use usePathname (client)
import { usePathname } from 'next/navigation'
import {
  Home, LayoutGrid, List, ShoppingBag as Orders,
  Zap, HelpCircle, Tag
} from 'lucide-react'

const desktopLinks = [
  { label: 'Home', href: '/' },
  { label: 'Categories', href: '/categories' },
  { label: 'All Listings', href: '/products' },
  { label: 'My Orders', href: '/orders' },
  { label: 'Campus Deals', href: '/deals', badge: 'New' },
  { label: 'Help Center', href: '/help' },
]

function SecondNav() {
  const pathname = usePathname()
  return (
    <div className="max-w-screen-2xl mx-auto px-4 flex items-center gap-1 h-10">
      {desktopLinks.map(({ label, href, badge }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-1.5 px-3 h-full text-sm font-medium transition-colors
              ${active
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
          >
            {label}
            {badge && (
              <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold leading-none">
                {badge}
              </span>
            )}
            {/* Active underline */}
            {active && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
            )}
          </Link>
        )
      })}
    </div>
  )
}
