"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, MapPin, Star, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/store/cart";

const SORT_OPTIONS = ["Newest", "Price: Low to High", "Price: High to Low", "Most Popular"];

function formatPrice(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  avg_rating: number;
  total_reviews: number;
  stock_quantity: number;
  status: string;
  created_at: string;
  categories: { name: string; slug: string } | null;
  sellers: { store_name: string } | null;
}

export default function ProductsPage() {
  const supabase = createClient();
  const { addItem } = useCartStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("Newest");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [addedToCart, setAddedToCart] = useState<string[]>([]);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, title, price, images, avg_rating,
          total_reviews, stock_quantity, status, created_at,
          categories ( name, slug ),
          sellers ( store_name )
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error && data) setProducts(data as unknown as Product[]);
      setLoading(false);
    }
    fetchProducts();
  }, []);

  const toggleWishlist = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      id: product.id,
      title: product.title,
      price: product.price,
      quantity: 1,
      image_url: product.images?.[0] ?? null,
      vendor_name: product.sellers?.store_name ?? null,
    });
    setAddedToCart(prev => [...prev, product.id]);
    setTimeout(() => setAddedToCart(prev => prev.filter(x => x !== product.id)), 2000);
  };

  // ── Sort filtering ───────────────────────────────────────────────────
  const filtered = products.slice().sort((a, b) => {
    if (sort === "Price: Low to High") return a.price - b.price;
    if (sort === "Price: High to Low") return b.price - a.price;
    if (sort === "Most Popular") return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Newest
  });

  const ProductCard = ({ product, mobile }: { product: Product; mobile: boolean }) => {
    const inCart = addedToCart.includes(product.id);
    const outOfStock = product.stock_quantity === 0;
    const wishlisted = wishlist.includes(product.id);
    const categoryName = product.categories?.name ?? "Other";
    const storeName = product.sellers?.store_name ?? "Vendor";

    return (
      <Link href={`/products/${product.id}`} className={mobile ? "mob-card" : "desk-card"}>
        <div className={mobile ? "mob-card-img" : "desk-card-img"}>
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: mobile ? 36 : 44 }}>📦</span>
          )}
          {outOfStock && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                background: "#ef4444", color: "white",
                padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              }}>Out of Stock</span>
            </div>
          )}
          <button className={mobile ? "mob-wishlist-btn" : "desk-wishlist-btn"}
            onClick={e => toggleWishlist(product.id, e)}>
            <Heart size={mobile ? 13 : 15}
              fill={wishlisted ? "#ef4444" : "none"}
              color={wishlisted ? "#ef4444" : "#9ca3af"} />
          </button>
        </div>

        <div className={mobile ? "mob-card-body" : "desk-card-body"}>
          <div className={mobile ? "mob-card-cat" : "desk-card-cat"}>{categoryName}</div>
          <div className={mobile ? "mob-card-title" : "desk-card-title"}>{product.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: mobile ? 4 : 6 }}>
            {[1,2,3,4,5].map(i => (
              <Star key={i} size={mobile ? 10 : 12}
                fill={i <= Math.round(product.avg_rating ?? 0) ? "#facc15" : "none"}
                color={i <= Math.round(product.avg_rating ?? 0) ? "#facc15" : "#d1d5db"} />
            ))}
            {product.total_reviews > 0 && (
              <span style={{ fontSize: mobile ? 10 : 11, color: "#9ca3af" }}>
                ({product.total_reviews})
              </span>
            )}
          </div>
          <div className={mobile ? "mob-card-price" : "desk-card-price"}>
            {formatPrice(product.price)}
          </div>
          <div className={mobile ? "mob-card-seller" : "desk-card-seller"}>
            <span className={mobile ? "mob-seller-av" : "desk-seller-av"}>{storeName[0]}</span>
            {storeName}
            <span>·</span>
            <MapPin size={mobile ? 9 : 10} />
            Campus
          </div>
          {!mobile && (
            <button className="desk-cart-btn"
              style={{
                background: inCart ? "#22c55e" : outOfStock ? "#e2e8f0" : "#2563eb",
                color: outOfStock ? "#9ca3af" : "white",
                cursor: outOfStock ? "not-allowed" : "pointer",
              }}
              disabled={outOfStock}
              onClick={e => { e.preventDefault(); if (!outOfStock) handleAddToCart(product, e); }}>
              <ShoppingCart size={14} />
              {inCart ? "Added!" : outOfStock ? "Out of Stock" : "Add to Cart"}
            </button>
          )}
        </div>
      </Link>
    );
  };

  const SkeletonCard = ({ mobile }: { mobile: boolean }) => (
    <div className={mobile ? "mob-card" : "desk-card"} style={{ pointerEvents: "none" }}>
      <div className={mobile ? "mob-card-img" : "desk-card-img"}
        style={{ background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      <div className={mobile ? "mob-card-body" : "desk-card-body"}>
        <div style={{ height: 10, width: "40%", background: "#e2e8f0", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 14, width: "90%", background: "#e2e8f0", borderRadius: 4, marginBottom: 6 }} />
        <div style={{ height: 14, width: "70%", background: "#e2e8f0", borderRadius: 4, marginBottom: 10 }} />
        <div style={{ height: 18, width: "50%", background: "#e2e8f0", borderRadius: 4 }} />
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── MOBILE TABS STRIP (no search bar) ── */
        .mob-strip {
          background: #2563eb;
          padding: 0 16px;
          position: sticky;
          top: 113px;
          z-index: 30;
        }
        .mob-tabs {
          display: flex; gap: 4px;
          overflow-x: auto; scrollbar-width: none;
        }
        .mob-tabs::-webkit-scrollbar { display: none; }
        .mob-tab {
          white-space: nowrap; padding: 10px 18px;
          border-radius: 999px 999px 0 0;
          font-size: 13px; border: none; cursor: pointer;
          background: transparent; color: rgba(255,255,255,0.7);
          transition: all 0.2s; font-weight: 500;
        }
        .mob-tab.active { background: white; color: #2563eb; font-weight: 600; }

        /* ── MOBILE CARDS ── */
        .mob-products-wrap {
          padding: 16px; padding-bottom: 88px;
          background: #f5f7ff; min-height: 100vh;
        }
        .dark .mob-products-wrap { background: #060d1f; }
        .mob-results-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .mob-results-count { font-size: 13px; color: #6b7280; }
        .dark .mob-results-count { color: #94a3b8; }
        .mob-sort-select { font-size: 13px; color: #2563eb; font-weight: 600; border: none; background: transparent; cursor: pointer; }
        .mob-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .mob-card {
          background: white; border-radius: 14px; overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.07);
          border: 1.5px solid #f1f5f9; position: relative;
          text-decoration: none; color: inherit; display: block;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .mob-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); transform: translateY(-2px); }
        .dark .mob-card { background: #0f1a35; border-color: #1e3a5f; }
        .mob-card-img {
          width: 100%; aspect-ratio: 1; position: relative;
          background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .mob-wishlist-btn {
          position: absolute; top: 8px; right: 8px;
          width: 28px; height: 28px; border-radius: 50%;
          background: white; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.15); z-index: 2;
        }
        .mob-card-body { padding: 10px; }
        .mob-card-cat { font-size: 10px; color: #2563eb; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .mob-card-title {
          font-size: 13px; font-weight: 600; color: #0f172a; line-height: 1.3; margin-bottom: 4px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .dark .mob-card-title { color: #f1f5f9; }
        .mob-card-price { font-size: 15px; font-weight: 700; color: #2563eb; margin-bottom: 5px; }
        .dark .mob-card-price { color: #60a5fa; }
        .mob-card-seller { font-size: 11px; color: #6b7280; display: flex; align-items: center; gap: 3px; }
        .dark .mob-card-seller { color: #94a3b8; }
        .mob-seller-av {
          width: 16px; height: 16px; border-radius: 50%;
          background: #dbeafe; display: inline-flex;
          align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700; color: #2563eb; flex-shrink: 0;
        }
        .dark .mob-seller-av { background: #1e3a5f; color: #60a5fa; }

        /* ── DESKTOP ── */
        .desk-wrap { padding: 24px; background: #f5f7ff; min-height: 100vh; }
        .dark .desk-wrap { background: #060d1f; }
        .desk-header { margin-bottom: 20px; }
        .desk-title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 2px; font-family: var(--font-sora), Sora, sans-serif; }
        .dark .desk-title { color: #f1f5f9; }
        .desk-subtitle { font-size: 14px; color: #6b7280; }
        .dark .desk-subtitle { color: #94a3b8; }
        .desk-tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1.5px solid #e2e8f0; }
        .dark .desk-tabs { border-color: #1e3a5f; }
        .desk-tab {
          padding: 8px 18px; font-size: 14px; font-weight: 500;
          border: none; background: transparent; color: #6b7280;
          cursor: pointer; border-bottom: 2.5px solid transparent;
          margin-bottom: -1.5px; transition: all 0.2s;
        }
        .dark .desk-tab { color: #94a3b8; }
        .desk-tab.active { color: #2563eb; border-bottom-color: #2563eb; font-weight: 600; }
        .desk-results-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .desk-results-count { font-size: 14px; color: #6b7280; }
        .dark .desk-results-count { color: #94a3b8; }
        .desk-sort { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6b7280; }
        .desk-sort select { font-size: 13px; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; background: white; color: #0f172a; cursor: pointer; outline: none; }
        .dark .desk-sort select { background: #0f1a35; border-color: #1e3a5f; color: #f1f5f9; }
        .desk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }

        /* ── DESKTOP CARD ── */
        .desk-card {
          background: white; border-radius: 16px; overflow: hidden;
          border: 1.5px solid #e2e8f0; position: relative;
          text-decoration: none; color: inherit; display: flex;
          flex-direction: column; transition: all 0.2s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .desk-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.1); transform: translateY(-3px); }
        .dark .desk-card { background: #0f1a35; border-color: #1e3a5f; }
        .desk-card-img {
          width: 100%; aspect-ratio: 1; position: relative;
          background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .desk-card-img img { transition: transform 0.3s; }
        .desk-card:hover .desk-card-img img { transform: scale(1.05); }
        .desk-wishlist-btn {
          position: absolute; top: 10px; right: 10px;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255,255,255,0.9); backdrop-filter: blur(4px);
          border: none; display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.15);
          transition: transform 0.2s; z-index: 2;
        }
        .desk-wishlist-btn:hover { transform: scale(1.1); }
        .desk-card-body { padding: 14px; flex: 1; display: flex; flex-direction: column; }
        .desk-card-cat { font-size: 11px; color: #2563eb; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .desk-card-title {
          font-size: 14px; font-weight: 600; color: #0f172a; line-height: 1.4; margin-bottom: 6px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1;
        }
        .dark .desk-card-title { color: #f1f5f9; }
        .desk-card-price { font-size: 17px; font-weight: 700; color: #2563eb; margin-bottom: 6px; }
        .dark .desk-card-price { color: #60a5fa; }
        .desk-card-seller { font-size: 12px; color: #6b7280; display: flex; align-items: center; gap: 4px; margin-bottom: 12px; }
        .dark .desk-card-seller { color: #94a3b8; }
        .desk-seller-av {
          width: 18px; height: 18px; border-radius: 50%;
          background: #dbeafe; display: inline-flex;
          align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: #2563eb; flex-shrink: 0;
        }
        .dark .desk-seller-av { background: #1e3a5f; color: #60a5fa; }
        .desk-cart-btn {
          width: 100%; padding: 9px; border-radius: 10px;
          border: none; font-size: 13px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: all 0.2s;
        }
        .desk-cart-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
      `}</style>

      {/* ════ MOBILE ════ */}
      <div className="md:hidden">
        {/* Tabs removed; showing product list only on mobile */}

        <div className="mob-products-wrap">
          <div className="mob-results-row">
            <span className="mob-results-count">
              {loading ? "Loading..." : `${filtered.length} products found`}
            </span>
            <select className="mob-sort-select" value={sort} onChange={e => setSort(e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="mob-grid">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} mobile />)
              : filtered.map(p => <ProductCard key={p.id} product={p} mobile />)
            }
          </div>
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 600 }}>No products found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try a different search term</div>
            </div>
          )}
        </div>
      </div>

      {/* ════ DESKTOP ════ */}
      <div className="hidden md:block desk-wrap">
        <div className="desk-header">
          <div className="desk-title">All Products</div>
          <div className="desk-subtitle">Browse listings from students on campus</div>
        </div>
        {/* Tabs removed; showing product list only on desktop */}
        <div className="desk-results-row">
          <span className="desk-results-count">
            {loading ? "Loading..." : `${filtered.length} products found`}
          </span>
          <div className="desk-sort">
            <span>Sort by:</span>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="desk-grid">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} mobile={false} />)
            : filtered.map(p => <ProductCard key={p.id} product={p} mobile={false} />)
          }
        </div>
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0", color: "#9ca3af" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>No products found</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>Try a different search term</div>
          </div>
        )}
      </div>
    </>
  );
}