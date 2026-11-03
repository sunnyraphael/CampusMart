'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { LayoutDashboard, PackageCheck, ShieldCheck, ShieldAlert, LifeBuoy, UserRoundCheck, UserRoundCog,Wallet,ShoppingBag } from 'lucide-react'

export const adminSections = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/operations', label: 'System health', icon: ShieldCheck },
  { href: '/admin/stores', label: 'Vendor stores', icon: ShoppingBag },
  { href: '/admin/deliveries', label: 'Deliveries', icon: PackageCheck },
  { href: '/admin/payments', label: 'Payments & refunds', icon: Wallet },
  { href: '/admin/verifications', label: 'Verifications', icon: ShieldCheck },
  { href: '/admin/disputes', label: 'Disputes', icon: ShieldAlert },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy },
  { href: '/admin/account-requests', label: 'Account requests', icon: UserRoundCog },
  { href: '/admin/guardian-permissions', label: 'Guardian permissions', icon: UserRoundCheck },
]
export default function AdminNav() {
  const pathname = usePathname()
  const ref=useRef<HTMLElement>(null)
  useEffect(()=>{
    const nav=ref.current
    const active=nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if(nav&&active&&nav.scrollWidth>nav.clientWidth)nav.scrollTo({left:Math.max(0,active.offsetLeft-nav.clientWidth/2+active.offsetWidth/2)})
  },[pathname])
  return <nav ref={ref} className="aw-nav" aria-label="Admin sections">{adminSections.map(({ href, label, icon: Icon }) => {
    const active = href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(href + '/')
    return <a key={href} href={href} className={`aw-nav-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}><Icon size={19} aria-hidden /><span>{label}</span></a>
  })}</nav>
}
