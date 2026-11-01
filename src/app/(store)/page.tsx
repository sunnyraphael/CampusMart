import Link from 'next/link'
import { ArrowRight, ChevronRight, Grid2X2, MessageCircle, PackageCheck, ShoppingBag, Store, FlaskConical } from 'lucide-react'
import ProductCard, { type ProductCardData } from '@/components/store/ProductCard'
import FeeDisclosure from '@/components/store/FeeDisclosure'
import { createClient } from '@/lib/supabase/server'
import { CARD_SELECT } from '@/lib/buyer/server'
import { retryCatalogRead } from '@/lib/buyer/catalog-read'
import { listingImages } from '@/lib/buyer/images'
import { trialCheckoutEnabled } from '@/lib/orders/trial'
import RetryListingsButton from '@/components/store/RetryListingsButton'

const steps=[
  {n:'01',title:'Find your next campus essential',text:'Compare the item, condition and vendor delivery estimate. Message the vendor if you need more details.'},
  {n:'02',title:'Review every charge',text:'Your cart and checkout show the item subtotal, service fee and any delivery charge before you place an order.'},
  {n:'03',title:'Keep track of your order',text:'Follow updates in My orders. Verify the handover and confirm receipt after inspecting the item, or report a problem.'},
]
export default async function HomePage() {
  const supabase=await createClient()
  const result=await retryCatalogRead(()=>supabase.from('products').select(CARD_SELECT).eq('status','active').gt('stock_quantity',0).order('created_at',{ascending:false}).order('id').limit(6).retry(false).abortSignal(AbortSignal.timeout(6000)))
  const listings=(result.data??[]) as unknown as ProductCardData[]
  const mosaic=listings.map(item=>({item,src:listingImages(item.images)[0]})).filter(row=>!!row.src).slice(0,4)
  const trial=trialCheckoutEnabled(process.env)
  if(result.error)console.error('[home] Listing query failed',{status:result.status,code:result.error.code,message:result.error.message,details:result.error.details})
  return <div className="hm sh-home">
    <section className="sh-hero" aria-labelledby="hm-h1"><div className="sh-hero-copy"><span className="sh-eyebrow">Made for campus life</span><h1 id="hm-h1">Your campus.<br/><span>Your next find.</span></h1><p>Useful things, campus vendors and a simpler way to shop. Find what you need for class, your room and everything in between.</p><div className="hm-btns"><Link href="/products" className="hm-btn hm-btn-primary">Browse listings <ArrowRight size={16} aria-hidden/></Link><Link href="/categories" className="hm-btn hm-btn-ghost">Explore categories</Link></div><Link className="sh-text-link" href="/how-it-works">New here? See how CampusMart works <ChevronRight size={14} aria-hidden/></Link></div>
      <aside className="sh-hero-aside">{mosaic.length===4?<div className="sh-mosaic">{mosaic.map(({item,src})=><Link href={`/products/${item.id}`} key={item.id} aria-label={item.title}><img referrerPolicy="no-referrer" src={src} alt="" loading="lazy" decoding="async"/></Link>)}</div>:<div className="sh-campus-mark"><ShoppingBag size={58} strokeWidth={1.2} aria-hidden/><span>Find it on campus.</span><p>Explore listings. Ask the vendor.<br/>Keep your order in one place.</p></div>}<div className="sh-aside-foot"><Store size={17} aria-hidden/><span>Something to sell?</span><Link href="/start-selling">Open a store <ArrowRight size={14} aria-hidden/></Link></div></aside>
    </section>
    <nav className="sh-shortcuts" aria-label="Shopping shortcuts">{[{href:'/categories',icon:Grid2X2,title:'Browse categories',text:'Start with what you need'},{href:'/orders',icon:PackageCheck,title:'Track your orders',text:'Follow delivery updates'},{href:'/messages',icon:MessageCircle,title:'Your conversations',text:'Talk with campus vendors'}].map(({href,icon:Icon,title,text})=><Link href={href} key={href}><span className="sh-shortcut-icon"><Icon size={21} strokeWidth={1.6} aria-hidden/></span><span><strong>{title}</strong><small>{text}</small></span><ChevronRight size={16} aria-hidden/></Link>)}</nav>
    <p className="sh-checkout-status"><FlaskConical size={17} aria-hidden/><span>{trial?'Trial checkout is available for testing. Trial orders collect no payment and create no real vendor earnings.':'Online payments are not live yet. You can browse, save items and contact vendors; no payment is collected on CampusMart.'}</span></p>
    <section aria-labelledby="hm-top"><div className="hm-head"><div><p className="sh-eyebrow">Explore the marketplace</p><h2 id="hm-top" className="hm-title">Fresh campus finds</h2></div><Link href="/products" className="hm-more">View all <ArrowRight size={14} aria-hidden/></Link></div><FeeDisclosure/>{result.error?<div className="buyer-panel buyer-stack" role="alert"><h3>Listings are temporarily unavailable</h3><p className="buyer-help">We could not load products right now. Please try again in a moment.</p><div><RetryListingsButton/></div></div>:listings.length?<div className="hm-grid">{listings.map(item=><ProductCard key={item.id} product={item} showCategory={false}/>)}</div>:<div className="sh-no-listings"><ShoppingBag size={28} aria-hidden/><h3>No listings available yet</h3><p>New items will appear here when vendors publish them.</p><Link href="/start-selling" className="buyer-btn">Become a vendor</Link></div>}</section>
    <section aria-labelledby="hm-how"><div className="hm-head"><div><p className="sh-eyebrow">A little clarity, before you buy</p><h2 id="hm-how" className="hm-title">How buying works</h2></div><Link href="/help" className="hm-more">Get help <ArrowRight size={14} aria-hidden/></Link></div><div className="hm-steps">{steps.map(step=><div className="hm-step" key={step.n}><span className="hm-step-n">{step.n}</span><h3 className="hm-step-title">{step.title}</h3><p className="hm-step-text">{step.text}</p></div>)}</div></section>
    <section className="sh-vendor-band" aria-labelledby="hm-vendor"><span className="sh-shortcut-icon"><Store size={25} aria-hidden/></span><div><p className="sh-eyebrow">Your ideas have a place here</p><h2 id="hm-vendor">Make your campus your marketplace.</h2><p>Explore what opening a store involves, including vendor terms and the 5% item commission.</p></div><Link href="/start-selling" className="hm-btn hm-btn-primary">Become a vendor <ArrowRight size={15} aria-hidden/></Link></section>
  </div>
}
