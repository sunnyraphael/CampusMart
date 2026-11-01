'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package,Heart,Bookmark,MessageCircle,Bell,UserRound,Settings,LifeBuoy,ArrowUpRight } from 'lucide-react'
const links=[{href:'/profile',label:'Your account',icon:UserRound},{href:'/orders',label:'Orders & tracking',icon:Package},{href:'/wishlist',label:'Favorites',icon:Heart},{href:'/saved',label:'Saved searches',icon:Bookmark},{href:'/messages',label:'Messages',icon:MessageCircle},{href:'/notifications',label:'Notifications',icon:Bell},{href:'/settings',label:'Settings & privacy',icon:Settings}]
export default function BuyerWorkspace({children}:{children:React.ReactNode}){
  const path=usePathname()
  const accountPage=links.some(link=>path===link.href||path.startsWith(link.href+'/'))||['/consent','/guardian-permission'].includes(path)
  if(!accountPage)return <div className="by-content">{children}</div>
  return <div className="by-workspace"><aside className="by-sidebar"><p className="by-eyebrow">Your CampusMart</p><nav aria-label="Buyer account navigation">{links.map(({href,label,icon:Icon})=><Link href={href} key={href} aria-current={path===href||path.startsWith(href+'/')?'page':undefined}><Icon size={18} aria-hidden/>{label}</Link>)}</nav><div className="by-side-help"><LifeBuoy size={22} aria-hidden/><h2>A little help?</h2><p>Find order help, understand fees or ask us a question.</p><Link href="/help">Visit the help centre <ArrowUpRight size={15} aria-hidden/></Link></div><Link className="by-side-permissions" href="/consent">Account permissions</Link><Link className="by-side-permissions" href="/guardian-permission">Guardian permission</Link></aside><div className="by-content">{children}</div></div>
}
