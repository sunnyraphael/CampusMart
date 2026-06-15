import { createClient } from "@/lib/supabase/server"
import { formatPrice, formatRelativeTime } from "@/lib/utils/format"
import {
  ArrowLeft, Star, ShoppingCart, Heart, Share2,
  ShieldCheck, Truck, MessageCircle, Store,
  Package, ChevronRight
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { ProductFull, Review } from "@/types"
import AddToCartButton from "./AddToCartButton"

async function getProduct(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("*, sellers(id, store_name, logo_url, is_verified, description), categories(name, slug)")
    .eq("id", id)
    .eq("status", "active")
    .single()
  return data as ProductFull | null
}

async function getReviews(productId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("reviews")
    .select("*, users(full_name, avatar_url)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(10)
  return (data as any[]) ?? []
}

async function getRelatedProducts(categoryId: string | null, currentId: string) {
  if (!categoryId) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("*, sellers(store_name)")
    .eq("category_id", categoryId)
    .eq("status", "active")
    .neq("id", currentId)
    .limit(4)
  return (data as any[]) ?? []
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) notFound()

  const [reviews, related] = await Promise.all([
    getReviews(product.id),
    getRelatedProducts(product.category_id, product.id),
  ])

  const avgRating = reviews.length
    ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
    : 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .pd-page { font-family: 'DM Sans', sans-serif; background: #f8faff; min-height: 100vh; }
        .pd-wrap { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
        @media(min-width:640px) { .pd-wrap { padding: 0 32px; } }
        @media(min-width:1024px) { .pd-wrap { padding: 0 48px; } }

        /* Breadcrumb */
        .breadcrumb {
          display: flex; align-items: center; gap: 8px;
          padding: 20px 0; font-size: 13px; color: #9ca3af; flex-wrap: wrap;
        }
        .breadcrumb a { color: #6b7280; text-decoration: none; transition: color 0.2s; }
        .breadcrumb a:hover { color: #2563eb; }
        .breadcrumb-sep { color: #d1d5db; }

        /* Main layout */
        .pd-main {
          display: grid; grid-template-columns: 1fr;
          gap: 32px; padding-bottom: 64px;
        }
        @media(min-width:1024px) { .pd-main { grid-template-columns: 1fr 1fr; gap: 56px; } }

        /* Image gallery */
        .gallery { display: flex; flex-direction: column; gap: 12px; }
        .gallery-main {
          aspect-ratio: 1; border-radius: 24px; overflow: hidden;
          background: linear-gradient(135deg, #f8faff, #eff2ff);
          border: 1px solid #f1f5f9;
          display: flex; align-items: center; justify-content: center;
        }
        .gallery-main img { width: 100%; height: 100%; object-fit: cover; }
        .gallery-thumbs { display: flex; gap: 10px; }
        .gallery-thumb {
          width: 72px; height: 72px; border-radius: 12px; overflow: hidden;
          border: 2px solid transparent; cursor: pointer; flex-shrink: 0;
          background: #f1f5f9; transition: border-color 0.2s;
        }
        .gallery-thumb.active { border-color: #2563eb; }
        .gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }

        /* Product info */
        .pd-info { display: flex; flex-direction: column; gap: 0; }
        .pd-category {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: #2563eb;
          text-transform: uppercase; letter-spacing: 0.08em;
          text-decoration: none; margin-bottom: 12px;
        }
        .pd-category:hover { text-decoration: underline; }
        .pd-title {
          font-family: 'Sora', sans-serif; font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 800; color: #0a0f2e; line-height: 1.2;
          letter-spacing: -0.02em; margin-bottom: 16px;
        }
        .pd-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
        .pd-rating { display: flex; align-items: center; gap: 6px; }
        .stars { display: flex; gap: 2px; }
        .pd-rating-count { font-size: 13px; color: #6b7280; }
        .pd-stock {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 600;
        }
        .pd-stock.in { background: #f0fdf4; color: #16a34a; }
        .pd-stock.low { background: #fffbeb; color: #d97706; }
        .pd-stock.out { background: #fef2f2; color: #dc2626; }
        .pd-stock-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .pd-price {
          font-family: 'Sora', sans-serif; font-size: 2rem; font-weight: 800;
          color: #0a0f2e; margin-bottom: 24px;
        }

        .pd-divider { height: 1px; background: #f1f5f9; margin: 24px 0; }

        /* Actions */
        .pd-actions { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .pd-qty { display: flex; align-items: center; gap: 0; border: 1.5px solid #e5e7eb; border-radius: 12px; width: fit-content; overflow: hidden; }
        .qty-btn { width: 40px; height: 44px; background: #f8faff; border: none; font-size: 18px; color: #374151; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; justify-content: center; }
        .qty-btn:hover { background: #eff6ff; color: #2563eb; }
        .qty-val { width: 48px; text-align: center; font-family: 'Sora', sans-serif; font-weight: 600; font-size: 15px; color: #111827; border: none; background: #fff; outline: none; }
        .btn-cart {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px 24px; border-radius: 12px;
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          color: #fff; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600;
          border: none; cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(37,99,235,0.35);
        }
        .btn-cart:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,99,235,0.45); filter: brightness(1.06); }
        .btn-wish {
          width: 48px; height: 48px; border-radius: 12px;
          border: 1.5px solid #e5e7eb; background: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; color: #6b7280; flex-shrink: 0;
        }
        .btn-wish:hover { border-color: #f43f5e; color: #f43f5e; background: #fff1f2; }
        .btn-share {
          width: 48px; height: 48px; border-radius: 12px;
          border: 1.5px solid #e5e7eb; background: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; color: #6b7280; flex-shrink: 0;
        }
        .btn-share:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; }

        /* Trust badges */
        .trust-row { display: flex; flex-wrap: wrap; gap: 16px; }
        .trust-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6b7280; }
        .trust-item svg { flex-shrink: 0; }

        /* Vendor card */
        .vendor-card {
          background: #fff; border-radius: 20px; border: 1px solid #f1f5f9;
          padding: 20px; display: flex; align-items: center; gap: 16px;
          text-decoration: none; transition: all 0.2s; margin-top: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .vendor-card:hover { border-color: #e0e7ff; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .vendor-avatar {
          width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; color: #fff;
        }
        .vendor-name { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; color: #0a0f2e; }
        .vendor-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #16a34a; margin-top: 2px; }
        .vendor-arrow { margin-left: auto; color: #9ca3af; }

        /* Description */
        .pd-desc-section { padding: 48px 0; }
        .pd-section-title { font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700; color: #0a0f2e; margin-bottom: 20px; }
        .pd-desc { font-size: 15px; color: #4b5563; line-height: 1.8; white-space: pre-wrap; }

        /* Reviews */
        .reviews-section { padding: 0 0 64px; }
        .review-summary { display: flex; align-items: center; gap: 32px; margin-bottom: 32px; flex-wrap: wrap; }
        .review-big-score { font-family: 'Sora', sans-serif; font-size: 4rem; font-weight: 800; color: #0a0f2e; line-height: 1; }
        .review-card { background: #fff; border-radius: 16px; border: 1px solid #f1f5f9; padding: 20px; margin-bottom: 12px; }
        .review-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .reviewer-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #eff6ff, #e0e7ff); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #2563eb; flex-shrink: 0; }
        .reviewer-name { font-size: 14px; font-weight: 600; color: #111827; }
        .review-date { font-size: 12px; color: #9ca3af; margin-left: auto; }
        .review-text { font-size: 14px; color: #4b5563; line-height: 1.6; }

        /* Related */
        .related-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media(min-width:640px) { .related-grid { grid-template-columns: repeat(4, 1fr); } }
        .related-card { background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #f1f5f9; text-decoration: none; transition: all 0.25s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .related-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); border-color: #e0e7ff; }
        .related-img { aspect-ratio: 1; background: linear-gradient(135deg, #f8faff, #eff2ff); overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .related-img img { width: 100%; height: 100%; object-fit: cover; }
        .related-body { padding: 12px; }
        .related-title { font-size: 13px; font-weight: 500; color: #111827; line-height: 1.4; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .related-price { font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700; color: #0a0f2e; }

        /* ── Mobile compact overrides ── */
        @media (max-width: 639px) {
          .breadcrumb { padding: 10px 0; font-size: 11px; }
          .gallery-main { aspect-ratio: 4/3; border-radius: 16px; }
          .pd-category { font-size: 11px; margin-bottom: 6px; }
          .pd-title { font-size: 1.2rem; margin-bottom: 8px; }
          .pd-meta { gap: 10px; margin-bottom: 10px; }
          .pd-price { font-size: 1.5rem; margin-bottom: 12px; }
          .pd-divider { margin: 14px 0; }
          .pd-actions { gap: 8px; margin-bottom: 14px; }
          .trust-row { gap: 10px; }
          .trust-item { font-size: 12px; }
          .vendor-card { padding: 14px; margin-top: 14px; }
          .pd-main { gap: 16px; padding-bottom: 32px; }
        }
      `}</style>

      <div className="pd-page">
        <div className="pd-wrap">

          {/* Breadcrumb */}
          <nav className="breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight size={14} className="breadcrumb-sep" />
            <Link href="/products">Products</Link>
            {product.categories && (
              <>
                <ChevronRight size={14} className="breadcrumb-sep" />
                <Link href={`/categories/${(product.categories as any).slug}`}>
                  {(product.categories as any).name}
                </Link>
              </>
            )}
            <ChevronRight size={14} className="breadcrumb-sep" />
            <span style={{ color: "#111827" }}>{product.title}</span>
          </nav>

          {/* Main product section */}
          <div className="pd-main">

            {/* Gallery */}
            <div className="gallery">
              <div className="gallery-main">
                {product.images && product.images.length > 0 ? (
                  <img src={product.images[0]} alt={product.title} />
                ) : (
                  <Package size={80} color="#cbd5e1" />
                )}
              </div>
              {product.images && product.images.length > 1 && (
                <div className="gallery-thumbs">
                  {product.images.slice(0, 5).map((img, i) => (
                    <div key={i} className={`gallery-thumb ${i === 0 ? "active" : ""}`}>
                      <img src={img} alt={`${product.title} ${i + 1}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className="pd-info">

              {product.categories && (
                <Link href={`/categories/${(product.categories as any).slug}`} className="pd-category">
                  <ChevronRight size={12} />
                  {(product.categories as any).name}
                </Link>
              )}

              <h1 className="pd-title">{product.title}</h1>

              {/* Rating + stock */}
              <div className="pd-meta">
                {reviews.length > 0 && (
                  <div className="pd-rating">
                    <div className="stars">
                      {[1,2,3,4,5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          color="#f59e0b"
                          fill={s <= Math.round(avgRating) ? "#f59e0b" : "none"}
                        />
                      ))}
                    </div>
                    <span className="pd-rating-count">
                      {avgRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
                    </span>
                  </div>
                )}
                <div className={`pd-stock ${product.stock_quantity > 10 ? "in" : product.stock_quantity > 0 ? "low" : "out"}`}>
                  <span className="pd-stock-dot" />
                  {product.stock_quantity > 10
                    ? "In Stock"
                    : product.stock_quantity > 0
                    ? `Only ${product.stock_quantity} left`
                    : "Out of Stock"}
                </div>
              </div>

              <div className="pd-price">{formatPrice(product.price)}</div>

              <div className="pd-divider" />

              {/* Add to cart */}
              <AddToCartButton product={product} />

              <div className="pd-divider" />

              {/* Trust badges */}
              <div className="trust-row">
                <div className="trust-item">
                  <ShieldCheck size={16} color="#16a34a" />
                  Secure Paystack payment
                </div>
                <div className="trust-item">
                  <Truck size={16} color="#2563eb" />
                  Campus delivery available
                </div>
                <div className="trust-item">
                  <MessageCircle size={16} color="#9333ea" />
                  WhatsApp order updates
                </div>
              </div>

              {/* Vendor card */}
              {product.sellers && (
                <Link href={`/vendors/${(product.sellers as any).id}`} className="vendor-card">
                  <div className="vendor-avatar">
                    {(product.sellers as any).store_name?.[0]?.toUpperCase() ?? "V"}
                  </div>
                  <div>
                    <div className="vendor-name">{(product.sellers as any).store_name}</div>
                    {(product.sellers as any).is_verified && (
                      <div className="vendor-badge">
                        <ShieldCheck size={11} /> Verified Vendor
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} className="vendor-arrow" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div style={{ background: "#fff", padding: "1px 0" }}>
            <div className="pd-wrap pd-desc-section">
              <div className="pd-section-title">Product Description</div>
              <p className="pd-desc">{product.description}</p>
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="pd-wrap reviews-section" style={{ paddingTop: 48 }}>
          <div className="pd-section-title">
            Customer Reviews {reviews.length > 0 && `(${reviews.length})`}
          </div>

          {reviews.length > 0 ? (
            <>
              <div className="review-summary">
                <div className="review-big-score">{avgRating.toFixed(1)}</div>
                <div>
                  <div className="stars" style={{ marginBottom: 6 }}>
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={20} color="#f59e0b" fill={s <= Math.round(avgRating) ? "#f59e0b" : "none"} />
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    Based on {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              {reviews.map((review: any) => (
                <div key={review.id} className="review-card">
                  <div className="review-header">
                    <div className="reviewer-avatar">
                      {review.users?.full_name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <div>
                      <div className="reviewer-name">{review.users?.full_name ?? "Anonymous"}</div>
                      <div className="stars">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} size={11} color="#f59e0b" fill={s <= review.rating ? "#f59e0b" : "none"} />
                        ))}
                      </div>
                    </div>
                    <span className="review-date">{formatRelativeTime(review.created_at)}</span>
                  </div>
                  {review.comment && <p className="review-text">{review.comment}</p>}
                </div>
              ))}
            </>
          ) : (
            <div style={{ background: "#fff", borderRadius: 16, border: "2px dashed #e0e7ff", padding: "40px 24px", textAlign: "center" }}>
              <Star size={32} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: "#0a0f2e", marginBottom: 6 }}>No reviews yet</div>
              <div style={{ fontSize: 14, color: "#9ca3af" }}>Be the first to review this product</div>
            </div>
          )}
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div style={{ background: "#fff", padding: "48px 0 64px" }}>
            <div className="pd-wrap">
              <div className="pd-section-title">You might also like</div>
              <div className="related-grid">
                {related.map((p: any) => (
                  <Link key={p.id} href={`/products/${p.id}`} className="related-card">
                    <div className="related-img">
                      {p.images?.[0]
                        ? <img src={p.images[0]} alt={p.title} />
                        : <Package size={40} color="#cbd5e1" />
                      }
                    </div>
                    <div className="related-body">
                      <div className="related-title">{p.title}</div>
                      <div className="related-price">{formatPrice(p.price)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}