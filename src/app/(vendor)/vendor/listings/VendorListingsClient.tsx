'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Package, Trash2, Loader2, ImageOff, X, Pencil, CheckCircle2,
} from 'lucide-react'

type Product = {
  id: string
  title: string
  price: number
  images: string[] | null
  status: string
  stock_quantity: number
  created_at: string
  compare_at_price: number | null
  sale_ends_at: string | null
}

type Filter = 'all' | 'active' | 'draft'
type Notice = 'created' | 'updated' | null

// Turns a stock number into the label buyers and vendors read.
function stockInfo(qty: number) {
  if (qty <= 0) return { label: 'Out of stock', tone: 'out' }
  if (qty <= 3) return { label: `Only ${qty} left`, tone: 'low' }
  return { label: `${qty} in stock`, tone: 'ok' }
}

// A promo counts only while the original price is higher and the sale has not ended.
function isOnSale(p: Product) {
  if (p.compare_at_price == null || p.compare_at_price <= p.price) return false
  return !p.sale_ends_at || new Date(p.sale_ends_at) > new Date()
}

export default function VendorListingsClient({
  products,
  notice: noticeFromUrl,
}: {
  products: Product[]
  notice: Notice
}) {
  const supabase = createClient()
  const router = useRouter()
  const [items, setItems] = useState(products)
  const [filter, setFilter] = useState<Filter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Remember the notice in state, then clean it out of the address bar.
  const [notice, setNotice] = useState<Notice>(noticeFromUrl)
  useEffect(() => {
    if (!noticeFromUrl) return
    router.replace('/vendor/listings', { scroll: false })
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo(() => ({
    all: items.length,
    active: items.filter(p => p.status === 'active').length,
    draft: items.filter(p => p.status === 'draft').length,
  }), [items])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter(p => p.status === filter)
  }, [items, filter])

  function closeModal() {
    setConfirmId(null)
    setDeleteError(null)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setDeleteError(null)
    const { error } = await supabase.from('products').delete().eq('id', id)
    setDeletingId(null)
    if (error) {
      setDeleteError(
        "We couldn't delete this listing. If it already has orders, unpublish it from the edit page instead."
      )
      return
    }
    setItems(prev => prev.filter(p => p.id !== id))
    closeModal()
  }

  return (
    <div className="listings-page">
      <div className="listings-header">
        <div>
          <h1 className="listings-title">Your Listings</h1>
          <p className="listings-subtitle">Manage the products in your store</p>
        </div>
        <Link href="/vendor/listings/new" className="new-listing-btn">
          <Plus size={18} strokeWidth={2.25} />
          New Listing
        </Link>
      </div>

      {notice && (
        <div className="notice" role="status">
          <CheckCircle2 size={18} strokeWidth={2} />
          <span>{notice === 'created' ? 'Listing created.' : 'Changes saved.'}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss message">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="filter-tabs" role="tablist" aria-label="Filter listings">
        {(['all', 'active', 'draft'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`filter-tab ${filter === f ? 'filter-tab-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Draft'}
            <span className="filter-count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Package size={40} strokeWidth={1.5} className="empty-icon" />
          <h3 className="empty-title">
            {filter === 'all' ? 'No listings yet' : `No ${filter} listings`}
          </h3>
          <p className="empty-text">
            {filter === 'all'
              ? 'Create your first listing to start selling on CampusMart.'
              : 'Try a different filter to see your other listings.'}
          </p>
          {filter === 'all' && (
            <Link href="/vendor/listings/new" className="empty-cta">
              <Plus size={16} strokeWidth={2.25} />
              Create a Listing
            </Link>
          )}
        </div>
      ) : (
        <div className="listings-grid">
          {filtered.map((product) => {
            const onSale = isOnSale(product)
            const percentOff = onSale
              ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
              : 0
            const stock = stockInfo(product.stock_quantity)

            return (
              <div
                key={product.id}
                className={`listing-card ${product.status === 'draft' ? 'listing-card-draft' : ''}`}
              >
                <div className="listing-image-wrap">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="listing-image"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="listing-image-placeholder">
                      <ImageOff size={22} strokeWidth={1.5} />
                    </div>
                  )}
                  <span className={`status-badge status-${product.status}`}>
                    {product.status === 'active' ? 'Active' : 'Draft'}
                  </span>
                  {onSale && <span className="promo-badge">{percentOff}% off</span>}
                </div>

                <div className="listing-body">
                  <h3 className="listing-title">{product.title}</h3>
                  <div className="listing-meta">
                    <div className="listing-pricing">
                      <span className="listing-price">₦{product.price.toLocaleString()}</span>
                      {onSale && (
                        <span className="listing-old">₦{product.compare_at_price!.toLocaleString()}</span>
                      )}
                    </div>
                    <span className={`listing-stock stock-${stock.tone}`}>{stock.label}</span>
                  </div>
                </div>

                <div className="listing-actions">
                  <Link
                    href={`/vendor/listings/${product.id}/edit`}
                    className="edit-trigger"
                    aria-label={`Edit ${product.title}`}
                  >
                    <Pencil size={15} strokeWidth={2} />
                    Edit
                  </Link>
                  <button
                    className="delete-trigger"
                    onClick={() => setConfirmId(product.id)}
                    aria-label={`Delete ${product.title}`}
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmId && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={closeModal}
              aria-label="Close"
            >
              <X size={18} strokeWidth={2} />
            </button>
            <h3 className="modal-title">Delete this listing?</h3>
            <p className="modal-text">
              This can&apos;t be undone. The listing will be permanently
              removed from your store. To change a price or photo instead,
              use Edit.
            </p>
            {deleteError && <p className="modal-error" role="alert">{deleteError}</p>}
            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={closeModal}
                disabled={deletingId === confirmId}
              >
                Cancel
              </button>
              <button
                className="modal-delete"
                onClick={() => handleDelete(confirmId)}
                disabled={deletingId === confirmId}
              >
                {deletingId === confirmId ? (
                  <>
                    <Loader2 size={16} strokeWidth={2} className="spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Listing'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ---------- Layout ---------- */
        .listings-page {
          max-width: 1100px;
          margin: 0 auto;
          /* The vendor layout already pads the sides, so this only adds top and bottom space */
          padding: clamp(8px, 2vw, 28px) 0 80px;
        }

        .listings-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px 16px;
          margin-bottom: clamp(16px, 4vw, 28px);
          flex-wrap: wrap;
        }

        .listings-title {
          font-family: 'Sora', sans-serif;
          font-size: clamp(20px, 4.5vw, 26px);
          font-weight: 600;
          color: #f1f5f9;
          letter-spacing: -0.02em;
          margin: 0 0 4px;
        }

        .listings-subtitle {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(13px, 3.2vw, 14px);
          color: #8fa3c4;
          margin: 0;
        }

        .new-listing-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #2563eb;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          padding: 10px 18px;
          border-radius: 10px;
          text-decoration: none;
          transition: transform 200ms ease-out, background 200ms ease-out;
        }
        .new-listing-btn:hover { background: #1d4ed8; transform: translateY(-2px); }
        .new-listing-btn:focus-visible,
        .filter-tab:focus-visible,
        .edit-trigger:focus-visible,
        .delete-trigger:focus-visible,
        .notice button:focus-visible,
        .empty-cta:focus-visible {
          outline: 2px solid #60a5fa;
          outline-offset: 2px;
        }

        /* ---------- Saved notice ---------- */
        .notice {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          padding: 10px 14px;
          background: #052e16;
          border: 1px solid #166534;
          border-radius: 10px;
          color: #86efac;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 500;
        }
        .notice span { flex: 1; }
        .notice button {
          display: flex;
          padding: 4px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: inherit;
          cursor: pointer;
        }

        /* ---------- Filter tabs ---------- */
        .filter-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: clamp(14px, 3.5vw, 24px);
          padding: 4px;
          background: #0f1a35;
          border: 1px solid #1e3a5f;
          border-radius: 12px;
          width: fit-content;
          max-width: 100%;
          overflow-x: auto;
        }

        .filter-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(12.5px, 3.2vw, 13.5px);
          font-weight: 500;
          color: #8fa3c4;
          background: transparent;
          border: none;
          padding: 8px clamp(10px, 3vw, 14px);
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: color 150ms ease-out, background 150ms ease-out;
        }
        .filter-tab:hover { color: #d8e2f5; }
        .filter-tab-active { background: #1e3a5f; color: #ffffff; }

        .filter-count {
          font-size: 11.5px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.08);
          padding: 1px 7px;
          border-radius: 999px;
        }
        .filter-tab-active .filter-count { background: #2563eb; }

        /* ---------- Grid ----------
           Phones: always exactly 2 columns, so there is no cliff where a
           phone that is a few pixels too narrow drops to one giant tile.
           Tiles then scale smoothly with the screen.
           Wider screens: as many 200px+ columns as fit. */
        .listings-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(8px, 2.5vw, 16px);
        }
        @media (min-width: 600px) {
          .listings-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          }
        }

        /* ---------- Card ---------- */
        .listing-card {
          position: relative;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: #0f1a35;
          border: 1px solid #1e3a5f;
          border-radius: clamp(10px, 2.5vw, 14px);
          overflow: hidden;
          transition: transform 250ms ease-out, border-color 250ms ease-out;
        }
        .listing-card-draft { opacity: 0.7; }

        .listing-image-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          background: #0a1428;
        }
        .listing-image { width: 100%; height: 100%; object-fit: cover; display: block; }
        .listing-image-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: #3a5480;
        }

        /* Solid backing so the badges stay readable on any photo */
        .status-badge,
        .promo-badge {
          position: absolute;
          top: clamp(6px, 2vw, 10px);
          font-family: 'DM Sans', sans-serif;
          font-size: 10.5px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          letter-spacing: 0.04em;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }
        .status-badge { left: clamp(6px, 2vw, 10px); text-transform: uppercase; }
        .status-active { background: #052e16; color: #86efac; border: 1px solid #166534; }
        .status-draft { background: #1e293b; color: #cbd5e1; border: 1px solid #475569; }
        .promo-badge { right: clamp(6px, 2vw, 10px); background: #2563eb; color: #ffffff; }

        .listing-body { flex: 1; padding: clamp(8px, 2.4vw, 12px); }

        .listing-title {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(13px, 3.4vw, 14.5px);
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 6px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .listing-meta {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-end;
          gap: 2px 8px;
        }
        .listing-pricing { display: flex; flex-direction: column; }
        .listing-price {
          font-family: 'Sora', sans-serif;
          font-size: clamp(13px, 3.6vw, 15px);
          font-weight: 600;
          color: #60a5fa;
        }
        .listing-old {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(11px, 2.9vw, 12px);
          color: #8fa3c4;
          text-decoration: line-through;
        }
        .listing-stock {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(11px, 2.9vw, 12px);
          color: #8fa3c4;
        }
        .stock-low { color: #fbbf24; font-weight: 600; }
        .stock-out { color: #f87171; font-weight: 600; }

        /* Action row: always visible, so phones and laptops get the same buttons */
        .listing-actions {
          display: flex;
          gap: 8px;
          padding: 0 clamp(8px, 2.4vw, 12px) clamp(8px, 2.4vw, 12px);
        }
        .edit-trigger {
          flex: 1;
          min-width: 0;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #d8e2f5;
          background: transparent;
          border: 1px solid #1e3a5f;
          border-radius: 8px;
          text-decoration: none;
          transition: background 200ms ease-out, border-color 200ms ease-out, color 200ms ease-out;
        }
        .edit-trigger:hover { background: #2563eb; border-color: #2563eb; color: #ffffff; }
        .delete-trigger {
          flex: none;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid #1e3a5f;
          border-radius: 8px;
          color: #8fa3c4;
          cursor: pointer;
          transition: background 200ms ease-out, color 200ms ease-out, border-color 200ms ease-out;
        }
        .delete-trigger:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border-color: rgba(248, 113, 113, 0.4);
        }
        @media (hover: hover) {
          .listing-card:hover { transform: translateY(-4px); border-color: #2563eb; }
          .listing-card-draft:hover { opacity: 0.9; }
        }

        /* ---------- Empty state ---------- */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: clamp(24px, 6vw, 56px) clamp(18px, 5vw, 32px);
          background: #0f1a35;
          border: 1px solid #1e3a5f;
          border-radius: 16px;
        }
        .empty-icon { color: #6b84ac; margin-bottom: 16px; }
        .empty-title {
          font-family: 'Sora', sans-serif;
          font-size: clamp(16px, 4vw, 18px);
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 6px;
        }
        .empty-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #8fa3c4;
          margin: 0 0 20px;
          max-width: 360px;
        }
        .empty-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #2563eb;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          padding: 10px 18px;
          border-radius: 10px;
          text-decoration: none;
          transition: background 200ms ease-out;
        }
        .empty-cta:hover { background: #1d4ed8; }

        /* ---------- Delete confirmation modal ---------- */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(6, 13, 31, 0.7);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 100;
          animation: fadeIn 220ms ease-out;
        }
        .modal-card {
          position: relative;
          width: 100%;
          max-width: 380px;
          background: #0f1a35;
          border: 1px solid #1e3a5f;
          border-radius: 16px;
          padding: 28px 22px 22px;
          animation: modalIn 250ms ease-out;
        }
        .modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: #8fa3c4;
          cursor: pointer;
          border-radius: 6px;
          transition: background 150ms ease-out, color 150ms ease-out;
        }
        .modal-close:hover { background: rgba(255, 255, 255, 0.06); color: #f1f5f9; }
        .modal-title {
          font-family: 'Sora', sans-serif;
          font-size: 17px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 8px;
        }
        .modal-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          line-height: 1.5;
          color: #8fa3c4;
          margin: 0 0 22px;
        }
        .modal-error {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          line-height: 1.45;
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 10px 12px;
          margin: -8px 0 16px;
        }
        .modal-actions { display: flex; gap: 10px; }
        .modal-cancel {
          flex: 1;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 600;
          color: #d8e2f5;
          background: transparent;
          border: 1px solid #1e3a5f;
          border-radius: 10px;
          padding: 11px;
          cursor: pointer;
          transition: background 150ms ease-out;
        }
        .modal-cancel:hover { background: rgba(255, 255, 255, 0.05); }
        .modal-delete {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 600;
          color: #fff;
          background: #dc2626;
          border: none;
          border-radius: 10px;
          padding: 11px;
          cursor: pointer;
          transition: background 150ms ease-out;
        }
        .modal-delete:hover:not(:disabled) { background: #b91c1c; }
        .modal-delete:disabled,
        .modal-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

        .spin { animation: spin 800ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ---------- Light mode (the vendor layout's own html.light system) ---------- */
        :is(html.light, html[data-theme="light"]) .listings-title { color: #0f172a; }
        :is(html.light, html[data-theme="light"]) .listings-subtitle { color: #64748b; }

        :is(html.light, html[data-theme="light"]) .notice { background: #dcfce7; border-color: #86efac; color: #14532d; }

        :is(html.light, html[data-theme="light"]) .filter-tabs { background: #ffffff; border-color: #e2e8f0; }
        :is(html.light, html[data-theme="light"]) .filter-tab { color: #64748b; }
        :is(html.light, html[data-theme="light"]) .filter-tab:hover { color: #0f172a; }
        :is(html.light, html[data-theme="light"]) .filter-tab-active { background: #2563eb; color: #ffffff; }
        :is(html.light, html[data-theme="light"]) .filter-count { background: rgba(15, 23, 42, 0.08); }
        :is(html.light, html[data-theme="light"]) .filter-tab-active .filter-count { background: rgba(255, 255, 255, 0.25); }

        :is(html.light, html[data-theme="light"]) .listing-card {
          background: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        :is(html.light, html[data-theme="light"]) .listing-image-wrap { background: #f1f5f9; }
        :is(html.light, html[data-theme="light"]) .listing-image-placeholder { color: #94a3b8; }
        :is(html.light, html[data-theme="light"]) .listing-title { color: #0f172a; }
        :is(html.light, html[data-theme="light"]) .listing-price { color: #2563eb; }
        :is(html.light, html[data-theme="light"]) .listing-old { color: #64748b; }
        :is(html.light, html[data-theme="light"]) .listing-stock { color: #64748b; }
        :is(html.light, html[data-theme="light"]) .stock-low { color: #b45309; }
        :is(html.light, html[data-theme="light"]) .stock-out { color: #b91c1c; }
        :is(html.light, html[data-theme="light"]) .status-active { background: #dcfce7; color: #14532d; border-color: #86efac; }
        :is(html.light, html[data-theme="light"]) .status-draft { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
        :is(html.light, html[data-theme="light"]) .edit-trigger { color: #334155; border-color: #cbd5e1; }
        :is(html.light, html[data-theme="light"]) .edit-trigger:hover { background: #2563eb; border-color: #2563eb; color: #ffffff; }
        :is(html.light, html[data-theme="light"]) .delete-trigger { color: #64748b; border-color: #cbd5e1; }
        :is(html.light, html[data-theme="light"]) .delete-trigger:hover {
          background: #fee2e2;
          color: #b91c1c;
          border-color: #fca5a5;
        }

        :is(html.light, html[data-theme="light"]) .empty-state { background: #ffffff; border-color: #e2e8f0; }
        :is(html.light, html[data-theme="light"]) .empty-icon { color: #94a3b8; }
        :is(html.light, html[data-theme="light"]) .empty-title { color: #0f172a; }
        :is(html.light, html[data-theme="light"]) .empty-text { color: #64748b; }

        :is(html.light, html[data-theme="light"]) .modal-overlay { background: rgba(15, 23, 42, 0.45); }
        :is(html.light, html[data-theme="light"]) .modal-card { background: #ffffff; border-color: #e2e8f0; }
        :is(html.light, html[data-theme="light"]) .modal-title { color: #0f172a; }
        :is(html.light, html[data-theme="light"]) .modal-text { color: #475569; }
        :is(html.light, html[data-theme="light"]) .modal-error { color: #b91c1c; background: #fee2e2; border-color: #fca5a5; }
        :is(html.light, html[data-theme="light"]) .modal-close { color: #64748b; }
        :is(html.light, html[data-theme="light"]) .modal-close:hover { background: rgba(15, 23, 42, 0.06); color: #0f172a; }
        :is(html.light, html[data-theme="light"]) .modal-cancel { color: #334155; border-color: #cbd5e1; }
        :is(html.light, html[data-theme="light"]) .modal-cancel:hover { background: #f1f5f9; }

        @media (prefers-reduced-motion: reduce) {
          .listing-card, .new-listing-btn, .modal-overlay, .modal-card, .spin {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  )
}