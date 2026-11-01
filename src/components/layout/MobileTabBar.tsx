'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Home, LayoutGrid, List, Zap, Menu, X, Package, Heart, Bookmark, MessageCircle, Bell, User, Settings, LogOut, Store, ShieldCheck, LifeBuoy, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useBuyerAccount } from '@/components/buyer/BuyerAccount'
import { createClient } from '@/lib/supabase/client'
import SearchForm from './SearchForm'

const tabs = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Categories', href: '/categories', icon: LayoutGrid },
  { label: 'Listings', href: '/products', icon: List },
  { label: 'Deals', href: '/deals', icon: Zap },
]

export function MobileTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, vendorState, isAdmin, messages, notifications, refresh } = useBuyerAccount()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  useEffect(()=>{
    const desktop=window.matchMedia('(min-width: 1280px)')
    const closeOnDesktop=()=>{if(desktop.matches)setOpen(false)}
    desktop.addEventListener('change',closeOnDesktop)
    return ()=>desktop.removeEventListener('change',closeOnDesktop)
  },[])
  const vendorHref = vendorState === 'active' ? '/vendor/dashboard' : vendorState === 'onboarding' ? '/vendor/onboarding' : '/start-selling'
  const accountLinks = [
    { label: 'My orders', href: '/orders', icon: Package, count: 0 },
    { label: 'Messages', href: '/messages', icon: MessageCircle, count: messages },
    { label: 'Notifications', href: '/notifications', icon: Bell, count: notifications },
    { label: 'Favorites', href: '/wishlist', icon: Heart, count: 0 },
    { label: 'Saved searches', href: '/saved', icon: Bookmark, count: 0 },
    { label: 'Profile', href: '/profile', icon: User, count: 0 },
  ]
  async function signOut() {
    setSigningOut(true)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) { toast.error('Could not sign out. Please try again.'); return }
      setOpen(false)
      refresh()
      router.push('/')
      router.refresh()
    } catch { toast.error('Check your connection and try signing out again.') }
    finally { setSigningOut(false) }
  }
  return <div className="xl:hidden sticky top-16 z-40 by-mobile-navigation" style={{ background: 'var(--navbar-bg)', borderBottom: '1px solid var(--navbar-border)' }}>
    <div className="px-4 py-2 flex items-center gap-2">
      <div className="min-w-0 flex-1"><SearchForm /></div>
      <Dropdown.Root open={open} onOpenChange={setOpen}>
        <Dropdown.Trigger className="by-menu-trigger" aria-label="Open account and help menu">
          {open ? <X size={21} aria-hidden/> : <Menu size={21} aria-hidden/>}
          <span>Menu</span>
          {(messages + notifications > 0) && <span className="by-menu-dot" aria-label="Unread updates"/>}
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content className="by-mobile-menu" align="end" sideOffset={8} collisionPadding={12} aria-label="Account and help">
            <Dropdown.Label className="by-menu-heading">{user ? 'Your CampusMart' : 'Welcome to CampusMart'}</Dropdown.Label>
            {user && accountLinks.map(({label,href,icon:Icon,count}) => <Dropdown.Item asChild key={href}><Link href={href} aria-current={pathname===href?'page':undefined}><Icon size={18} aria-hidden/>{label}{count>0&&<span className="by-menu-count">{count>99?'99+':count}</span>}</Link></Dropdown.Item>)}
            {!user && <><Dropdown.Item asChild><Link href="/login"><LogIn size={18} aria-hidden/>Log in</Link></Dropdown.Item><Dropdown.Item asChild><Link href="/register"><User size={18} aria-hidden/>Create account</Link></Dropdown.Item></>}
            <Dropdown.Separator className="by-menu-separator"/>
            <Dropdown.Item asChild><Link href="/help"><LifeBuoy size={18} aria-hidden/>Help & support</Link></Dropdown.Item>
            {vendorState!=='loading'&&<Dropdown.Item asChild><Link href={vendorHref}><Store size={18} aria-hidden/>{vendorState==='active'?'Vendor dashboard':'Open your store'}</Link></Dropdown.Item>}
            {isAdmin&&<Dropdown.Item asChild><Link href="/admin"><ShieldCheck size={18} aria-hidden/>Admin workspace</Link></Dropdown.Item>}
            <Dropdown.Separator className="by-menu-separator"/>
            <Dropdown.Item asChild><Link href="/settings"><Settings size={18} aria-hidden/>Settings & privacy</Link></Dropdown.Item>
            {user&&<Dropdown.Item className="by-menu-signout" disabled={signingOut} onSelect={event=>{event.preventDefault();void signOut()}}><LogOut size={18} aria-hidden/>{signingOut?'Signing out…':'Sign out'}</Dropdown.Item>}
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </div>
    <nav className="by-mobile-tabs" aria-label="Main shopping navigation">
      {tabs.map(({label,href,icon:Icon})=>{
        const active=pathname===href||(href!=='/'&&pathname.startsWith(href+'/'))
        return <Link key={href} href={href} aria-current={active?'page':undefined}><Icon size={16} aria-hidden/>{label}</Link>
      })}
    </nav>
  </div>
}
