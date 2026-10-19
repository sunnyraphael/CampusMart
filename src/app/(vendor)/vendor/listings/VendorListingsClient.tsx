'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Package, Trash2, Loader2, ImageOff, X,
} from 'lucide-react'

type Product = {
  id: string
  title: string
  price: number
  images: string[] | null
  status: string
  stock_quantity: number
  created_at: string
}

type Filter = 'all' | 'active' | 'draft'

export default function VendorListingsClient({ products }: { products: Product[] }) {
  const supabase = createClient()
  const [items, setItems] = useState(products)
  const [filter, setFilter] = useState<Filter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const counts = useMemo(() => ({
    all: items.length,
    active: items.filter(p => p.status === 'active').length,
    draft: items.filter(p => p.status === 'draft').length,
  }), [items])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter(p => p.status === filter)
  }, [items, filter])

  async function handleDelete(id: string) {
    setDeletingId(id)
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (!error) {
      setItems(prev => prev.filter(p => p.id !== id))
    }
    setDeletingId(null)
    setConfirmId(null)
  }
    return (
    <div className="listings-page">
      <div className="listings-header">
        <div>
          <h1 className="listings-title">Your Listings</h1>
          <p className="listings-subtitle">
            Manage the products in your store
          </p>
        </div>
        <Link href="/vendor/listings/new" className="new-listing-btn">
          <Plus size={18} strokeWidth={2.25} />
          New Listing
        </Link>
      </div>

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
          {filtered.map((product) => (
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
                  />
                ) : (
                  <div className="listing-image-placeholder">
                    <ImageOff size={22} strokeWidth={1.5} />
                  </div>
                )}
                <span className={`status-badge status-${product.status}`}>
                  {product.status === 'active' ? 'Active' : 'Draft'}
                </span>
              </div>

              <div className="listing-body">
                <h3 className="listing-title">{product.title}</h3>
                <div className="listing-meta">
                  <span className="listing-price">
                    ₦{product.price.toLocaleString()}
                  </span>
                  <span className="listing-stock">
                    {product.stock_quantity} in stock
                  </span>
                </div>
              </div>

              <button
                className="delete-trigger"
                onClick={() => setConfirmId(product.id)}
                aria-label={`Delete ${product.title}`}
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmId && (
        <div className="modal-overlay" onClick={() => setConfirmId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setConfirmId(null)}
              aria-label="Close"
            >
              <X size={18} strokeWidth={2} />
            </button>
            <h3 className="modal-title">Delete this listing?</h3>
            <p className="modal-text">
              This can&apos;t be undone. The listing will be permanently
              removed from your store.
            </p>
            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => setConfirmId(null)}
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
        .listings-page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 32px 20px 80px;
        }

        .listings-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        .listings-title {
          font-family: 'Sora', sans-serif;
          font-size: 26px;
          font-weight: 600;
          color: var(--foreground, #f1f5f9);
          letter-spacing: -0.02em;
          margin: 0 0 4px;
        }

        .listings-subtitle {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
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

        .new-listing-btn:hover {
          background: #1d4ed8;
          transform: translateY(-2px);
        }

        .new-listing-btn:focus-visible {
          outline: 2px solid #60a5fa;
          outline-offset: 2px;
        }

        .filter-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 24px;
          padding: 4px;
          background: #0f1a35;
          border: 1px solid #1e3a5f;
          border-radius: 12px;
          width: fit-content;
        }

        .filter-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 500;
          color: #8fa3c4;
          background: transparent;
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: color 150ms ease-out, background 150ms ease-out;
        }

        .filter-tab:hover {
          color: #d8e2f5;
        }

        .filter-tab-active {
          background: #1e3a5f;
          color: #ffffff;
        }

        .filter-count {
          font-size: 11.5px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.08);
          padding: 1px 7px;
          border-radius: 999px;
        }

        .filter-tab-active .filter-count {
          background: #2563eb;
        }

        .listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
          gap: 12px;
        }

        .listing-card {
          position: relative;
          background: #0f1a35;
          border: 1px solid #1e3a5f;
          border-radius: 14px;
          overflow: hidden;
          transition: transform 250ms ease-out, border-color 250ms ease-out;
        }

        .listing-card:hover {
          transform: translateY(-4px);
          border-color: #2563eb;
        }

        .listing-card-draft {
          opacity: 0.55;
        }

        .listing-card-draft:hover {
          opacity: 0.85;
        }

        .listing-image-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          background: #0a1428;
        }

        .listing-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .listing-image-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3a5480;
        }

        .status-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .status-active {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.25);
        }

        .status-draft {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.25);
        }

        .listing-body {
          padding: 10px 10px 12px;
        }

        .listing-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 14.5px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 8px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .listing-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .listing-price {
          font-family: 'Sora', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #60a5fa;
        }

        .listing-stock {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          color: #6b84ac;
        }

        .delete-trigger {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 20, 40, 0.85);
          border: 1px solid #1e3a5f;
          border-radius: 8px;
          color: #94a3b8;
          cursor: pointer;
          opacity: 0;
          transition: opacity 200ms ease-out, background 200ms ease-out, color 200ms ease-out;
        }

        .listing-card:hover .delete-trigger {
          opacity: 1;
        }

        .delete-trigger:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.3);
        }

        .delete-trigger:focus-visible {
          opacity: 1;
          outline: 2px solid #60a5fa;
          outline-offset: 2px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: 56px 32px;
          background: #0f1a35;
          border: 1px solid #1e3a5f;
          border-radius: 16px;
        }

        .empty-icon {
          color: #3a5480;
          margin-bottom: 16px;
        }

        .empty-title {
          font-family: 'Sora', sans-serif;
          font-size: 18px;
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

        .empty-cta:hover {
          background: #1d4ed8;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(6, 13, 31, 0.7);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
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
          padding: 28px 24px 24px;
          animation: modalIn 250ms ease-out;
        }

        .modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: #6b84ac;
          cursor: pointer;
          border-radius: 6px;
          transition: background 150ms ease-out, color 150ms ease-out;
        }

        .modal-close:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #f1f5f9;
        }

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

        .modal-actions {
          display: flex;
          gap: 10px;
        }

        .modal-cancel {
          flex: 1;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 600;
          color: #d8e2f5;
          background: transparent;
          border: 1px solid #1e3a5f;
          border-radius: 10px;
          padding: 10px;
          cursor: pointer;
          transition: background 150ms ease-out;
        }

        .modal-cancel:hover {
          background: rgba(255, 255, 255, 0.05);
        }

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
          padding: 10px;
          cursor: pointer;
          transition: background 150ms ease-out;
        }

        .modal-delete:hover:not(:disabled) {
          background: #b91c1c;
        }

        .modal-delete:disabled,
        .modal-cancel:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 800ms linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

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