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
      <style>{`
        .hm { --hm-accent: #2563eb; --hm-accent-hover: #1d4ed8; display: flex; flex-direction: column; gap: clamp(32px, 5vw, 56px); padding-bottom: 72px; }
        @media (min-width: 768px) { .hm { padding-bottom: 0; } }
        .hm a:focus-visible { outline: 2px solid var(--hm-accent); outline-offset: 2px; }

        /* Hero */
        .hm-hero { display: grid; gap: 24px; padding: clamp(20px, 5vw, 48px); background: var(--vx-hero); border: 1px solid var(--vx-border); border-radius: 16px; }
        .hm-h1 { font-family: var(--font-sora), Sora, sans-serif; font-size: clamp(28px, 6vw, 44px); font-weight: 700; line-height: 1.12; letter-spacing: -0.02em; color: var(--vx-text); margin: 0 0 12px; max-width: 18ch; }
        .hm-sub { font-size: clamp(14px, 2.4vw, 16px); line-height: 1.55; color: var(--vx-text-soft); margin: 0 0 24px; max-width: 46ch; }
        .hm-btns { display: flex; flex-wrap: wrap; gap: 10px; }
        .hm-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 20px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; transition: background-color .15s ease-out, border-color .15s ease-out; }
        .hm-btn-primary { background: var(--hm-accent); color: #fff; border: 1px solid var(--hm-accent); }
        .hm-btn-primary:hover { background: var(--hm-accent-hover); border-color: var(--hm-accent-hover); }
        .hm-btn-ghost { background: var(--vx-card); color: var(--vx-text); border: 1px solid var(--vx-border); }
        .hm-btn-ghost:hover { border-color: var(--hm-accent); }

        /* Real listing photos beside the headline (wide screens only) */
        .hm-mosaic { display: none; }
        @media (min-width: 900px) {
          .hm-hero.has-mosaic { grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); align-items: center; gap: 40px; }
          .hm-mosaic { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        }
        .hm-tile { position: relative; display: block; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: var(--vx-surface); border: 1px solid var(--vx-border); }
        .hm-tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .2s ease-out; }
        .hm-tile:hover img { transform: scale(1.03); }

        /* Section headers */
        .hm-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .hm-title { font-family: var(--font-sora), Sora, sans-serif; font-size: clamp(17px, 2.6vw, 20px); font-weight: 700; color: var(--vx-text); margin: 0; }
        .hm-more { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; font-size: 13px; font-weight: 600; color: var(--vx-link); text-decoration: none; }
        .hm-more:hover { text-decoration: underline; }

        /* Compact listings keep two columns on phones. */
        .hm-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        @media (min-width: 640px) { .hm-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; } }
        @media (min-width: 1100px) { .hm-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }

        /* How it works: hairline columns, no boxes */
        .hm-steps { display: grid; gap: 20px; }
        @media (min-width: 768px) { .hm-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; } }
        .hm-step { border-top: 1px solid var(--vx-border); padding-top: 16px; }
        .hm-step-n { font-family: var(--font-sora), Sora, sans-serif; font-size: 13px; font-weight: 600; color: var(--vx-link); margin-bottom: 8px; }
        .hm-step-title { font-size: 16px; font-weight: 600; color: var(--vx-text); margin: 0 0 6px; }
        .hm-step-text { font-size: 14px; line-height: 1.55; color: var(--vx-text-soft); margin: 0; max-width: 40ch; }

        /* Vendor band */
        .hm-band { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 24px; padding: clamp(18px, 4vw, 28px); background: var(--vx-card); border: 1px solid var(--vx-border); border-radius: 16px; }
        .hm-band-text { flex: 1 1 280px; min-width: 0; }
        .hm-band h2 { font-family: var(--font-sora), Sora, sans-serif; font-size: clamp(17px, 2.6vw, 20px); font-weight: 700; color: var(--vx-text); margin: 0 0 6px; }
        .hm-band p { font-size: 14px; line-height: 1.55; color: var(--vx-text-soft); margin: 0; max-width: 56ch; }

        @media (prefers-reduced-motion: reduce) {
          .hm *, .hm *::before { transition: none !important; }
          .hm a:hover { transform: none !important; }
        }
      `}</style>

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
