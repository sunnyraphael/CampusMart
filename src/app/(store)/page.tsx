import Link from 'next/link'
import ProductCard, { type ProductCardData } from '@/components/store/ProductCard'
import { createClient } from '@/lib/supabase/server'
import { CARD_SELECT } from '@/lib/buyer/server'
import { retryCatalogRead } from '@/lib/buyer/catalog-read'
import RetryListingsButton from '@/components/store/RetryListingsButton'
import { ArrowRight } from 'lucide-react'

const steps = [
  { n: '01', title: 'Find what you need', text: 'Browse listings from student vendors on your campus.' },
  { n: '02', title: 'Pay on CampusMart', text: 'Your payment is held by CampusMart. It is not sent to the vendor yet.' },
  { n: '03', title: 'Confirm when it arrives', text: 'Tap Received and the vendor is paid. If something is wrong, open a dispute and we review it before any payout.' },
]

// The images column can be an array, a JSON string or a plain URL. Return one URL or null.
function getImage(images: unknown): string | null {
  if (!images) return null
  if (Array.isArray(images)) {
    const first = images[0]
    return typeof first === 'string' && first ? first : null
  }
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed)) return typeof parsed[0] === 'string' && parsed[0] ? parsed[0] : null
    } catch {
      /* not JSON, so it is a plain URL */
    }
    return images
  }
  return null
}

export default async function HomePage() {
  const supabase = await createClient()
  const result = await retryCatalogRead(() => supabase
      .from('products')
      .select(CARD_SELECT)
      .eq('status', 'active')
      .gt('stock_quantity', 0)
      .order('avg_rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(6)
      .retry(false)
      .abortSignal(AbortSignal.timeout(6000)))
  const { data: rows, error: listingError } = result

  const listings = (rows ?? []) as unknown as ProductCardData[]
  const mosaic = listings.map((l) => ({ l, src: getImage(l.images) })).filter((x) => x.src).slice(0, 4)
  if (listingError) console.error('[home] Listing query failed', { status: result.status, code: listingError.code, message: listingError.message, details: listingError.details })
  const vendorHref = '/start-selling'

  return (
    <>


      <div className="hm">
        {/* Hero */}
        <section className={`hm-hero${mosaic.length === 4 ? ' has-mosaic' : ''}`} aria-labelledby="hm-h1">
          <div>
            <h1 id="hm-h1" className="hm-h1">Buy and sell with students on your campus.</h1>
            <p className="hm-sub">
              Browse listings from student vendors. Your payment is held until your order arrives.
            </p>
            <div className="hm-btns">
              <Link href="/products" className="hm-btn hm-btn-primary">Browse listings</Link>
              <Link href={vendorHref} className="hm-btn hm-btn-ghost">Become a vendor</Link>
            </div>
          </div>

          {mosaic.length === 4 && (
            <div className="hm-mosaic">
              {mosaic.map(({ l, src }) => (
                <Link key={l.id} href={`/products/${l.id}`} className="hm-tile" aria-label={l.title}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src as string} alt="" loading="lazy" decoding="async" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Top rated listings, real data */}
        {(listingError || listings.length > 0) && (
          <section aria-labelledby="hm-top">
            <div className="hm-head">
              <h2 id="hm-top" className="hm-title">Top rated listings</h2>
              <Link href="/products" className="hm-more">View all <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
            {listingError ? <div className="buyer-panel buyer-stack" role="alert"><h3>Listings are temporarily unavailable</h3><p className="buyer-help">We couldn’t load products right now. Please try again in a moment.</p><div><RetryListingsButton /></div></div> : <div className="hm-grid">
              {listings.map((item) => (
                <ProductCard key={item.id} product={item} showCategory={false} />
              ))}
            </div>}
          </section>
        )}

        {/* How it works */}
        <section aria-labelledby="hm-how">
          <div className="hm-head">
            <h2 id="hm-how" className="hm-title">How buying works</h2>
          </div>
          <div className="hm-steps">
            {steps.map((s) => (
              <div key={s.n} className="hm-step">
                <div className="hm-step-n">{s.n}</div>
                <h3 className="hm-step-title">{s.title}</h3>
                <p className="hm-step-text">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Vendor call to action */}
        <section className="hm-band" aria-labelledby="hm-vendor">
          <div className="hm-band-text">
            <h2 id="hm-vendor">Have something to sell?</h2>
            <p>Open a vendor account, list in minutes, and get paid once the buyer confirms delivery. CampusMart keeps 5 percent per item.</p>
          </div>
          <Link href={vendorHref} className="hm-btn hm-btn-primary">Become a vendor</Link>
        </section>
      </div>
    </>
  )
}
