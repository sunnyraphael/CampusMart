import Link from 'next/link'
import JoinCard from '@/components/home/JoinCard'
import { createClient } from '@/lib/supabase/server'
import {
  BookOpen, Laptop, Armchair, Shirt, ShoppingBag,
  Dumbbell, Sparkles, PenLine, LayoutGrid,
  GraduationCap, Shield, MapPin, Leaf,
  ArrowRight, Star, Heart, CheckCircle2
} from 'lucide-react'

const categories = [
  { label: 'Books & Notes', icon: BookOpen, color: '#4f46e5', bg: '#eef2ff', href: '/products?category=books' },
  { label: 'Electronics', icon: Laptop, color: '#d97706', bg: '#fef3c7', href: '/products?category=electronics' },
  { label: 'Furniture', icon: Armchair, color: '#b45309', bg: '#fef9ee', href: '/products?category=furniture' },
  { label: 'Clothing', icon: Shirt, color: '#2563eb', bg: '#eff6ff', href: '/products?category=clothing' },
  { label: 'Accessories', icon: ShoppingBag, color: '#e11d48', bg: '#fff1f2', href: '/products?category=accessories' },
  { label: 'Sports & Fitness', icon: Dumbbell, color: '#7c3aed', bg: '#f5f3ff', href: '/products?category=sports' },
  { label: 'Beauty & Health', icon: Sparkles, color: '#db2777', bg: '#fdf2f8', href: '/products?category=beauty' },
  { label: 'Stationery', icon: PenLine, color: '#0891b2', bg: '#ecfeff', href: '/products?category=stationery' },
  { label: 'Other', icon: LayoutGrid, color: '#6b7280', bg: '#f9fafb', href: '/products?category=other' },
]

const trustItems = [
  { icon: GraduationCap, title: 'Made for Students', sub: 'By students, for students.' },
  { icon: Shield, title: 'Safe & Secure', sub: 'Your safety is our priority.' },
  { icon: MapPin, title: 'Local & Convenient', sub: 'Meet on campus or nearby.' },
  { icon: Leaf, title: 'Sustainable Choice', sub: 'Give items a second life.' },
]

function formatPrice(n: number) {
  return '₦' + n.toLocaleString('en-NG')
}

// Helper to get the first image URL from the images column
function getImage(images: string | string[] | null): string {
  if (!images) return 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80'
  if (Array.isArray(images)) return images[0] || ''
  try {
    const parsed = JSON.parse(images)
    return Array.isArray(parsed) ? parsed[0] : images
  } catch {
    return images
  }
}

export default async function HomePage() {
  const supabase = await createClient()
  const [{ data: { user } }, { data: listings }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('products')
      .select('id, title, price, images, avg_rating')
      .eq('status', 'active')
      .order('avg_rating', { ascending: false })
      .limit(5),
  ])

  const popularListings = listings ?? []

  return (
    <>
      <style>{`
        /* ── Light mode tokens ── */
        .cm-page { background: #f5f7ff; }
        .cm-hero {
          background: #eef2ff;
          border-radius: 20px;
          margin: 16px;
          overflow: hidden;
          position: relative;
          min-height: 220px;
          display: flex;
          align-items: stretch;
        }
        .cm-hero-text { padding: 28px 24px; flex: 1; z-index: 2; position: relative; }
        .cm-hero-h1 {
          font-family: var(--font-sora), Sora, sans-serif;
          font-size: 28px;
          font-weight: 800;
          line-height: 1.15;
          color: #0f172a;
          margin-bottom: 10px;
        }
        .cm-hero-h1 span { color: #2563eb; }
        .cm-hero-sub { font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px; max-width: 220px; }
        .cm-hero-btns { display: flex; gap: 10px; flex-wrap: wrap; }
        .cm-btn-primary {
          background: #2563eb; color: white;
          padding: 10px 20px; border-radius: 12px;
          font-size: 13px; font-weight: 600;
          text-decoration: none; transition: background 0.2s;
          display: inline-block;
        }
        .cm-btn-primary:hover { background: #1d4ed8; }
        .cm-btn-outline {
          background: white; color: #0f172a;
          border: 1.5px solid #cbd5e1;
          padding: 10px 20px; border-radius: 12px;
          font-size: 13px; font-weight: 600;
          text-decoration: none; transition: all 0.2s;
          display: inline-block;
        }
        .cm-btn-outline:hover { border-color: #2563eb; color: #2563eb; }
        /* Hero photo — right side */
        .cm-hero-photo {
          position: absolute; right: 0; top: 0; bottom: 0;
          width: 55%; overflow: hidden;
        }
        .cm-hero-photo img {
          width: 100%; height: 100%; object-fit: cover;
          object-position: center top;
        }
        /* gradient fade left edge of photo */
        .cm-hero-photo::before {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0; width: 60%;
          background: linear-gradient(to right, #eef2ff 20%, transparent 100%);
          z-index: 1;
        }
        /* Decorative scribble */
        .cm-hero-scribble {
          position: absolute; top: 16px; right: 30%;
          color: #2563eb; opacity: 0.3; z-index: 3;
        }

        /* ── Section ── */
        .cm-section { padding: 0 16px; margin-top: 28px; }
        .cm-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .cm-section-title {
          font-family: var(--font-sora), Sora, sans-serif;
          font-size: 18px; font-weight: 700; color: #0f172a;
        }
        .cm-view-all { font-size: 13px; font-weight: 600; color: #2563eb; text-decoration: none; display: flex; align-items: center; gap: 3px; }
        .cm-view-all:hover { text-decoration: underline; }

        /* ── Category grid ── */
        .cm-cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .cm-cat-item {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 14px 8px; border-radius: 16px;
          background: white; border: 1.5px solid #e2e8f0;
          text-decoration: none; transition: all 0.2s;
        }
        .cm-cat-item:hover { border-color: #2563eb; box-shadow: 0 2px 8px rgba(37,99,235,0.1); }
        .cm-cat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .cm-cat-label { font-size: 11px; font-weight: 500; color: #475569; text-align: center; line-height: 1.3; }

        /* ── Listing cards (mobile: horizontal scroll) ── */
        .cm-listings-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; scroll-snap-type: x mandatory; scrollbar-width: none; }
        .cm-listings-scroll::-webkit-scrollbar { display: none; }
        .cm-listing-card {
          flex-shrink: 0; width: 160px; scroll-snap-align: start;
          border-radius: 16px; overflow: hidden;
          background: white; border: 1.5px solid #e2e8f0;
          text-decoration: none; color: inherit; display: block;
          transition: box-shadow 0.2s;
        }
        .cm-listing-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .cm-card-img-wrap { position: relative; overflow: hidden; }
        .cm-card-img-wrap img { width: 100%; aspect-ratio: 1; object-fit: cover; transition: transform 0.3s; }
        .cm-listing-card:hover .cm-card-img-wrap img { transform: scale(1.04); }
        .cm-wishlist { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,0.12); }
        .cm-card-body { padding: 10px; }
        .cm-card-title { font-size: 13px; font-weight: 600; color: #0f172a; line-height: 1.3; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .cm-card-price { font-size: 14px; font-weight: 700; color: #2563eb; margin-bottom: 6px; }
        .cm-card-meta { display: flex; align-items: center; justify-content: space-between; }
        .cm-card-rating { display: flex; align-items: center; gap: 2px; font-size: 11px; color: #64748b; }

        /* ── Join card (mobile) ── */
        .cm-join-card {
          margin: 28px 16px 0;
          background: white; border: 1.5px solid #e2e8f0;
          border-radius: 20px; padding: 20px;
          display: flex; align-items: center; gap: 16px;
        }
        .cm-join-icon { width: 56px; height: 56px; flex-shrink: 0; }
        .cm-join-text h3 { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px; font-family: var(--font-sora), Sora, sans-serif; }
        .cm-join-text p { font-size: 12px; color: #64748b; line-height: 1.4; }
        .cm-join-actions { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        .cm-join-login { font-size: 12px; color: #64748b; }
        .cm-join-login a { color: #2563eb; font-weight: 600; text-decoration: none; }

        /* ── Trust strip (mobile) ── */
        .cm-trust-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 16px 24px; }
        .cm-trust-item { display: flex; align-items: center; gap: 10px; background: white; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 12px; }
        .cm-trust-icon { width: 36px; height: 36px; border-radius: 10px; background: #eff6ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cm-trust-title { font-size: 11px; font-weight: 600; color: #0f172a; }
        .cm-trust-sub { font-size: 10px; color: #64748b; }

        /* ── DARK MODE ── */
        .dark .cm-page { background: #060d1f; }
        .dark .cm-hero { background: #0f1a35; }
        .dark .cm-hero-photo::before { background: linear-gradient(to right, #0f1a35 20%, transparent 100%); }
        .dark .cm-hero-h1 { color: #f1f5f9; }
        .dark .cm-hero-sub { color: #94a3b8; }
        .dark .cm-btn-outline { background: transparent; color: #e2e8f0; border-color: #334155; }
        .dark .cm-btn-outline:hover { border-color: #3b82f6; color: #3b82f6; }
        .dark .cm-section-title { color: #f1f5f9; }
        .dark .cm-cat-item { background: #0f1a35; border-color: #1e3a5f; }
        .dark .cm-cat-item:hover { border-color: #3b82f6; }
        .dark .cm-cat-label { color: #94a3b8; }
        .dark .cm-listing-card { background: #0f1a35; border-color: #1e3a5f; }
        .dark .cm-card-title { color: #f1f5f9; }
        .dark .cm-card-price { color: #60a5fa; }
        .dark .cm-card-rating { color: #94a3b8; }
        .dark .cm-wishlist { background: #1e293b; }
        .dark .cm-join-card { background: #0f1a35; border-color: #1e3a5f; }
        .dark .cm-join-text h3 { color: #f1f5f9; }
        .dark .cm-join-text p { color: #94a3b8; }
        .dark .cm-join-login { color: #94a3b8; }
        .dark .cm-trust-item { background: #0f1a35; border-color: #1e3a5f; }
        .dark .cm-trust-icon { background: #1e3a5f; }
        .dark .cm-trust-title { color: #f1f5f9; }
        .dark .cm-trust-sub { color: #94a3b8; }

        /* ── DESKTOP OVERRIDES (md+) ── */
        @media (min-width: 768px) {
          .cm-hero { margin: 0 0 0 0; border-radius: 20px; min-height: 320px; }
          .cm-hero-h1 { font-size: 42px; }
          .cm-hero-sub { font-size: 15px; max-width: 360px; }
          .cm-hero-photo { width: 50%; }
          .cm-section { padding: 0; margin-top: 32px; }
          .cm-cat-grid { grid-template-columns: repeat(9, 1fr); gap: 12px; }
          .cm-cat-item { padding: 16px 8px; }
          .cm-listings-scroll { display: grid; grid-template-columns: repeat(5, 1fr); overflow-x: visible; }
          .cm-listing-card { width: auto; }
          .cm-join-card { display: none; }
          .cm-trust-grid { display: none; }
        }
      `}</style>

      <div className="cm-page min-h-screen pb-20 md:pb-0">

        {/* ── Mobile layout ── */}
        <div className="md:hidden">

          {/* Hero */}
          <div className="cm-hero">
            <div className="cm-hero-text">
              <h1 className="cm-hero-h1">
                Buy. Sell.<br />Connect.<br />
                All on <span>Campus.</span>
              </h1>
              <p className="cm-hero-sub">
                The student marketplace for buying and selling what you need.
              </p>
              <div className="cm-hero-btns">
                <Link href="/products" className="cm-btn-primary">Browse Listings</Link>
                <Link href="/vendor/new" className="cm-btn-outline">Sell an Item</Link>
              </div>
            </div>
            <div className="cm-hero-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80"
                alt="Students on campus"
              />
            </div>
            <svg className="cm-hero-scribble" width="50" height="50" viewBox="0 0 60 60" fill="none">
              <path d="M5 30 Q 20 5 35 30 Q 50 55 55 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <path d="M50 20 L55 30 L44 28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>

          {/* Categories */}
          <div className="cm-section">
            <div className="cm-section-header">
              <span className="cm-section-title">Shop by Category</span>
              <Link href="/categories" className="cm-view-all">View all <ArrowRight size={13}/></Link>
            </div>
            <div className="cm-cat-grid">
              {categories.slice(0, 6).map(({ label, icon: Icon, color, bg, href }) => (
                <Link key={label} href={href} className="cm-cat-item">
                  <div className="cm-cat-icon" style={{ backgroundColor: bg }}>
                    <Icon size={20} style={{ color }} strokeWidth={1.8} />
                  </div>
                  <span className="cm-cat-label">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Popular Listings — real data */}
          <div className="cm-section" style={{marginTop: 28}}>
            <div className="cm-section-header">
              <span className="cm-section-title">Popular Listings</span>
              <Link href="/products" className="cm-view-all">View all <ArrowRight size={13}/></Link>
            </div>
            <div className="cm-listings-scroll">
              {popularListings.map(item => (
                <Link key={item.id} href={`/products/${item.id}`} className="cm-listing-card">
                  <div className="cm-card-img-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getImage(item.images)} alt={item.title} />
                    <button className="cm-wishlist">
                      <Heart size={13} color="#9ca3af" />
                    </button>
                  </div>
                  <div className="cm-card-body">
                    <div className="cm-card-title">{item.title}</div>
                    <div className="cm-card-price">{formatPrice(item.price)}</div>
                    <div className="cm-card-meta">
                      <div className="cm-card-rating">
                        <Star size={11} style={{color: '#fbbf24', fill: '#fbbf24'}} />
                        {item.avg_rating?.toFixed(1) ?? '—'}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Join CampusMart card */}
          {!user && (
          <div className="cm-join-card">
            <svg className="cm-join-icon" viewBox="0 0 56 56" fill="none">
              <rect width="56" height="56" rx="16" fill="#eff6ff"/>
              <path d="M28 10 L40 18 L40 36 L28 44 L16 36 L16 18 Z" fill="#2563eb" opacity="0.15"/>
              <path d="M28 10 L40 18 L40 36 L28 44 L16 36 L16 18 Z" stroke="#2563eb" strokeWidth="2" fill="none"/>
              <circle cx="28" cy="24" r="6" fill="#2563eb"/>
              <path d="M18 40 Q22 32 28 32 Q34 32 38 40" fill="#2563eb" opacity="0.5"/>
            </svg>
            <div style={{flex: 1}}>
              <div className="cm-join-text">
                <h3>Join CampusMart</h3>
                <p>Create an account to buy, sell, and connect with students on campus.</p>
              </div>
              <div className="cm-join-actions">
                <Link href="/register" className="cm-btn-primary" style={{fontSize: 13}}>Sign Up</Link>
                <p className="cm-join-login">Already have an account? <Link href="/login">Log In</Link></p>
              </div>
            </div>
          </div>
          )}

          {/* Trust grid */}
          <div className="cm-trust-grid">
            {trustItems.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="cm-trust-item">
                <div className="cm-trust-icon">
                  <Icon size={18} color="#2563eb" />
                </div>
                <div>
                  <div className="cm-trust-title">{title}</div>
                  <div className="cm-trust-sub">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Desktop layout ── */}
        <div className="hidden md:block px-6 py-6">

          {/* Hero */}
          <div className="cm-hero">
            <div className="cm-hero-text">
              <h1 className="cm-hero-h1">
                Buy. Sell. Connect.<br />
                All on <span>Campus.</span>
              </h1>
              <p className="cm-hero-sub">
                CampusMart is the student marketplace for buying and selling what you need.
              </p>
              <div className="cm-hero-btns">
                <Link href="/products" className="cm-btn-primary">Browse Listings</Link>
                <Link href="/vendor/new" className="cm-btn-outline">Sell an Item</Link>
              </div>
            </div>
            <div className="cm-hero-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80"
                alt="Students on campus"
              />
            </div>
            <svg className="cm-hero-scribble" width="60" height="60" viewBox="0 0 60 60" fill="none">
              <path d="M5 30 Q 20 5 35 30 Q 50 55 55 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <path d="M50 20 L55 30 L44 28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>

          {/* Main + right sidebar */}
          <div className="flex gap-6 mt-8">
            <div className="flex-1 min-w-0 space-y-8">

              {/* Categories */}
              <section className="cm-section">
                <div className="cm-section-header">
                  <span className="cm-section-title">Shop by Category</span>
                  <Link href="/categories" className="cm-view-all">View all <ArrowRight size={14}/></Link>
                </div>
                <div className="cm-cat-grid">
                  {categories.map(({ label, icon: Icon, color, bg, href }) => (
                    <Link key={label} href={href} className="cm-cat-item">
                      <div className="cm-cat-icon" style={{ backgroundColor: bg }}>
                        <Icon size={22} style={{ color }} strokeWidth={1.8} />
                      </div>
                      <span className="cm-cat-label">{label}</span>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Popular Listings — real data */}
              <section className="cm-section">
                <div className="cm-section-header">
                  <span className="cm-section-title">Popular Listings</span>
                  <Link href="/products" className="cm-view-all">View all <ArrowRight size={14}/></Link>
                </div>
                <div className="cm-listings-scroll">
                  {popularListings.map(item => (
                    <Link key={item.id} href={`/products/${item.id}`} className="cm-listing-card">
                      <div className="cm-card-img-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getImage(item.images)} alt={item.title} />
                        <button className="cm-wishlist">
                          <Heart size={13} color="#9ca3af" />
                        </button>
                      </div>
                      <div className="cm-card-body">
                        <div className="cm-card-title">{item.title}</div>
                        <div className="cm-card-price">{formatPrice(item.price)}</div>
                        <div className="cm-card-meta">
                          <div className="cm-card-rating">
                            <Star size={11} style={{color: '#fbbf24', fill: '#fbbf24'}} />
                            {item.avg_rating?.toFixed(1) ?? '—'}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Desktop trust bar */}
              <div className="grid grid-cols-4 gap-4 pt-4 pb-8">
                {trustItems.map(({ icon: Icon, title, sub }) => (
                  <div key={title} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right sidebar */}
            <JoinCard />
          </div>
        </div>

      </div>
    </>
  )
}