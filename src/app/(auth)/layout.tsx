import Link from 'next/link'
import { ArrowLeft, ShoppingBag, MessageCircle, PackageCheck, SlidersHorizontal } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

export default function AuthLayout({children}:{children:React.ReactNode}) {
  return <div className="min-h-screen flex flex-col" style={{background:'var(--page-bg)',color:'var(--vx-text)'}}>
    <header style={{borderBottom:'1px solid var(--navbar-border)',background:'var(--navbar-bg)',padding:'16px max(18px, calc((100vw - 1080px) / 2))',display:'flex',alignItems:'center',justifyContent:'space-between',gap:15,flexWrap:'wrap',flexShrink:0}}>
      <Link href="/" style={{display:'inline-flex',alignItems:'center',gap:10,fontFamily:'var(--font-sora)',fontWeight:700,fontSize:19,color:'var(--vx-text)',textDecoration:'none',letterSpacing:-.7}}><span style={{display:'inline-grid',placeItems:'center',width:33,height:36,borderRadius:9,background:'#2563eb',color:'white'}}><ShoppingBag size={20} aria-hidden/></span><span>Campus<span style={{color:'var(--vx-link)'}}>Mart</span></span></Link>
      <div style={{display:'flex',alignItems:'center',gap:14}}><ThemeToggle/><Link href="/" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:'var(--vx-muted)',textDecoration:'none'}}><ArrowLeft size={15} aria-hidden/>Back to store</Link></div>
    </header>
    <main className="buyer-auth-area" style={{flex:1}}><aside className="buyer-auth-story"><span className="sh-eyebrow">A place for campus finds</span><h2>Your campus,<br/>a little closer.</h2><p>Find useful things, talk to campus vendors and keep your shopping in one place.</p><ul><li><ShoppingBag size={20} strokeWidth={1.6} aria-hidden/><span>Compare item details, condition and vendor estimates before ordering.</span></li><li><PackageCheck size={20} strokeWidth={1.6} aria-hidden/><span>Follow order updates and inspect your purchase before confirming receipt.</span></li><li><MessageCircle size={20} strokeWidth={1.6} aria-hidden/><span>Keep conversations with vendors available in your CampusMart inbox.</span></li><li><SlidersHorizontal size={20} strokeWidth={1.6} aria-hidden/><span>Review account permissions and manage your information in Settings.</span></li></ul></aside>{children}</main>
    <footer className="by-policy-links" style={{justifyContent:'center',padding:'19px 18px',borderTop:'1px solid var(--vx-border)',background:'var(--vx-card)'}}><Link href="/privacy">Privacy policy</Link><Link href="/terms">Buyer terms</Link><Link href="/refunds">Refund policy</Link><Link href="/cookies">Cookie policy</Link></footer>
  </div>
}
