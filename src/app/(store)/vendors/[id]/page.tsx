import { createClient } from "@/lib/supabase/server"
import { formatPrice, formatDate } from "@/lib/utils/format"
import { ShieldCheck, MapPin, Package, Star, ChevronRight, Tag, CalendarDays } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

type Vendor = {
  id: string
  store_name: string
  description: string | null
  logo_url: string | null
  category: string | null
  state: string | null
  campus: string | null
  is_verified: boolean | null
  created_at: string | null
}

async function getVendor(id: string): Promise<Vendor | null> {
  const supabase = await createClient()
  // Reads the safe public view, never the sellers table itself
  const { data } = await (supabase as any)
    .from("public_vendors")
    .select("id, store_name, description, logo_url, category, state, campus, is_verified, created_at")
    .eq("id", id)
    .maybeSingle()
  return (data as Vendor | null) ?? null
}

async function getVendorProducts(vendorId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("id, title, price, images, avg_rating, total_reviews, stock_quantity, created_at, categories(name)")
    .eq("seller_id", vendorId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
  return (data as any[]) ?? []
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const vendor = await getVendor(id)
  return { title: vendor ? `${vendor.store_name} | CampusMart` : "Vendor not found | CampusMart" }
}

export default async function VendorStorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vendor = await getVendor(id)
  if (!vendor) notFound()

  const products = await getVendorProducts(vendor.id)

  // Weighted average, so a product with 40 reviews counts more than one with 1
  const totalReviews = products.reduce((s, p) => s + (p.total_reviews ?? 0), 0)
  const weighted = products.reduce((s, p) => s + (p.avg_rating ?? 0) * (p.total_reviews ?? 0), 0)
  const rating = totalReviews > 0 ? weighted / totalReviews : 0

  const location = [vendor.campus, vendor.state].filter(Boolean).join(", ")

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .vs-page { font-family: 'DM Sans', sans-serif; background: #f8faff; min-height: 100vh; overflow-x: hidden; }
        .dark .vs-page { background: #0a1226; }
        .vs-wrap { max-width: 1280px; margin: 0 auto; padding: 0 16px; }
        @media(min-width:640px) { .vs-wrap { padding: 0 32px; } }
        @media(min-width:1024px) { .vs-wrap { padding: 0 48px; } }

        .vs-crumbs { display: flex; align-items: center; gap: 8px; padding: 16px 0; font-size: 13px; color: #6b7280; flex-wrap: wrap; }
        .vs-crumbs a { color: #6b7280; text-decoration: none; }
        .vs-crumbs a:hover { color: #2563eb; }
        .vs-crumb-current { color: #0a0f2e; font-weight: 500; }
        .dark .vs-crumbs, .dark .vs-crumbs a { color: #94a3b8; }
        .dark .vs-crumb-current { color: #e2e8f0; }

        .vs-header {
          display: flex; flex-direction: column; gap: 20px;
          background: #ffffff; border: 1px solid #e5e7eb; border-radius: 20px;
          padding: 20px; margin-bottom: 32px;
        }
        .dark .vs-header { background: #0f1a35; border-color: #1e3a5f; }
        @media(min-width:768px) { .vs-header { flex-direction: row; align-items: center; padding: 32px; gap: 28px; } }

        .vs-logo {
          width: 80px; height: 80px; border-radius: 20px; flex-shrink: 0; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe;
          font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 800;
        }
        .dark .vs-logo { background: #1e3a5f; color: #60a5fa; border-color: #1e3a5f; }
        .vs-logo img { width: 100%; height: 100%; object-fit: cover; }
        @media(min-width:768px) { .vs-logo { width: 104px; height: 104px; font-size: 40px; } }

        .vs-head-body { min-width: 0; flex: 1; }
        .vs-name-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
        .vs-name {
          font-family: 'Sora', sans-serif; font-size: clamp(1.4rem, 4vw, 2rem); font-weight: 800;
          color: #0a0f2e; letter-spacing: -0.02em; line-height: 1.15; overflow-wrap: anywhere;
        }
        .dark .vs-name { color: #f1f5f9; }
        .vs-badge {
          display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 100px;
          font-size: 12px; font-weight: 600; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;
        }
        .dark .vs-badge { background: rgba(16,185,129,0.12); color: #6ee7b7; border-color: rgba(16,185,129,0.3); }
        .vs-desc { font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 16px; max-width: 62ch; }
        .dark .vs-desc { color: #94a3b8; }

        .vs-facts { display: flex; flex-wrap: wrap; gap: 8px 20px; }
        .vs-fact { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #4b5563; min-width: 0; }
        .vs-fact svg { flex-shrink: 0; color: #2563eb; }
        .dark .vs-fact { color: #cbd5e1; }
        .dark .vs-fact svg { color: #60a5fa; }

        .vs-section-title { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; color: #0a0f2e; margin-bottom: 16px; }
        .dark .vs-section-title { color: #f1f5f9; }
        .vs-count { font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 14px; color: #6b7280; margin-left: 6px; }
        .dark .vs-count { color: #94a3b8; }

        .vs-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding-bottom: 64px; }
        @media(min-width:640px) { .vs-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; } }
        @media(min-width:1024px) { .vs-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; } }

        .vs-card {
          display: flex; flex-direction: column; min-width: 0; text-decoration: none; overflow: hidden;
          background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .vs-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .dark .vs-card { background: #0f1a35; border-color: #1e3a5f; }
        .vs-card-img { position: relative; aspect-ratio: 1; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; }
        .dark .vs-card-img { background: #14223f; color: #475569; }
        .vs-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .vs-out {
          position: absolute; left: 8px; top: 8px; padding: 3px 10px; border-radius: 100px;
          font-size: 11px; font-weight: 700; background: #fee2e2; color: #b91c1c;
        }
        .dark .vs-out { background: rgba(239,68,68,0.18); color: #fca5a5; }
        .vs-card-body { padding: 12px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .vs-card-cat { font-size: 11px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.06em; }
        .dark .vs-card-cat { color: #60a5fa; }
        .vs-card-title {
          font-size: 14px; font-weight: 600; color: #0a0f2e; line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .dark .vs-card-title { color: #f1f5f9; }
        .vs-card-rating { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280; }
        .vs-card-rating svg { color: #f59e0b; fill: #f59e0b; }
        .dark .vs-card-rating { color: #94a3b8; }
        .vs-card-price { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; color: #0a0f2e; margin-top: 2px; }
        .dark .vs-card-price { color: #ffffff; }

        .vs-empty {
          display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
          padding: 56px 20px; margin-bottom: 64px; border-radius: 20px;
          background: #ffffff; border: 1px dashed #cbd5e1; color: #6b7280;
        }
        .dark .vs-empty { background: #0f1a35; border-color: #1e3a5f; color: #94a3b8; }
        .vs-empty strong { color: #0a0f2e; font-family: 'Sora', sans-serif; }
        .dark .vs-empty strong { color: #f1f5f9; }
      `}</style>

      <div className="vs-page">
        <div className="vs-wrap">
          <nav className="vs-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight size={14} />
            <Link href="/products">Products</Link>
            <ChevronRight size={14} />
            <span className="vs-crumb-current">{vendor.store_name}</span>
          </nav>

          <section className="vs-header">
            <div className="vs-logo">
              {vendor.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vendor.logo_url} alt={`${vendor.store_name} logo`} />
              ) : (
                vendor.store_name[0]?.toUpperCase() ?? "V"
              )}
            </div>

            <div className="vs-head-body">
              <div className="vs-name-row">
                <h1 className="vs-name">{vendor.store_name}</h1>
                {vendor.is_verified && (
                  <span className="vs-badge"><ShieldCheck size={13} /> Verified vendor</span>
                )}
              </div>
              {vendor.description && <p className="vs-desc">{vendor.description}</p>}
              <div className="vs-facts">
                {location && <span className="vs-fact"><MapPin size={15} />{location}</span>}
                {vendor.category && <span className="vs-fact"><Tag size={15} />{vendor.category}</span>}
                {vendor.created_at && (
                  <span className="vs-fact"><CalendarDays size={15} />Vendor since {formatDate(vendor.created_at)}</span>
                )}
                {rating > 0 && (
                  <span className="vs-fact"><Star size={15} />{rating.toFixed(1)} from {totalReviews} review{totalReviews === 1 ? "" : "s"}</span>
                )}
              </div>
            </div>
          </section>

          <h2 className="vs-section-title">
            Products<span className="vs-count">{products.length}</span>
          </h2>

          {products.length === 0 ? (
            <div className="vs-empty">
              <Package size={28} />
              <strong>No products yet</strong>
              <span>This vendor has not listed anything. Check back soon.</span>
            </div>
          ) : (
            <div className="vs-grid">
              {products.map((p) => (
                <Link key={p.id} href={`/products/${p.id}`} className="vs-card">
                  <div className="vs-card-img">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.title} />
                    ) : (
                      <Package size={32} />
                    )}
                    {p.stock_quantity === 0 && <span className="vs-out">Out of stock</span>}
                  </div>
                  <div className="vs-card-body">
                    {p.categories?.name && <span className="vs-card-cat">{p.categories.name}</span>}
                    <span className="vs-card-title">{p.title}</span>
                    {p.total_reviews > 0 && (
                      <span className="vs-card-rating">
                        <Star size={12} />{Number(p.avg_rating ?? 0).toFixed(1)} ({p.total_reviews})
                      </span>
                    )}
                    <span className="vs-card-price">{formatPrice(p.price)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}