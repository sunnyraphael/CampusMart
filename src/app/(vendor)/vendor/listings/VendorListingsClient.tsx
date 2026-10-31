'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, ImageOff, X, Pencil, CheckCircle2, Search, ArrowUpRight } from 'lucide-react'
import { deleteListing } from '@/lib/vendor/actions'
import { PageHeading, EmptyState } from '@/components/vendor/Workspace'
import CleanupButton from './CleanupButton'

type Product = { id: string; title: string; price: number; images: string[] | null; status: string; stock_quantity: number; created_at: string; compare_at_price: number | null; sale_ends_at: string | null; availability: string | null }
type Filter = 'all' | 'active' | 'draft'
type Stock = 'all' | 'low' | 'out'
type Sort = 'newest' | 'price-asc' | 'price-desc' | 'stock'
type Notice = 'created' | 'updated' | null

export default function VendorListingsClient({ products, now, notice: noticeFromUrl, initialFilter = 'all', initialStock = 'all' }: { products: Product[]; now: number; notice: Notice; initialFilter?: Filter; initialStock?: Stock }) {
  const router = useRouter()
  const [deleted, setDeleted] = useState<string[]>([])
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [stock, setStock] = useState<Stock>(initialStock)
  const [sort, setSort] = useState<Sort>('newest')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState(noticeFromUrl)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const items = useMemo(() => products.filter(p => !deleted.includes(p.id)), [products, deleted])
  const counts = { all: items.length, active: items.filter(p => p.status === 'active').length, draft: items.filter(p => p.status === 'draft').length }
  const lowCount = items.filter(p => p.status === 'active' && p.availability !== 'pre_order' && p.stock_quantity <= 3).length

  useEffect(() => {
    if (!noticeFromUrl) return
    const url = new URL(window.location.href); url.searchParams.delete('created'); url.searchParams.delete('updated')
    router.replace(url.pathname + url.search, { scroll: false })
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [noticeFromUrl, router])
  useEffect(() => {
    if (confirmId) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [confirmId])

  const filtered = useMemo(() => items.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false
    if (query.trim() && !p.title.toLowerCase().includes(query.trim().toLowerCase())) return false
    if (stock !== 'all' && p.availability === 'pre_order') return false
    if (stock === 'low' && (p.status !== 'active' || p.stock_quantity > 3)) return false
    if (stock === 'out' && p.stock_quantity > 0) return false
    return true
  }).sort((a, b) => sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : sort === 'stock' ? a.stock_quantity - b.stock_quantity : +new Date(b.created_at) - +new Date(a.created_at)), [items, filter, query, stock, sort])

  function close() { if (!deleting) { setConfirmId(null); setDeleteError(null) } }
  async function remove() {
    if (!confirmId || deleting) return
    setDeleting(true); setDeleteError(null)
    try {
      const result = await deleteListing(confirmId)
      if ('error' in result) { setDeleteError(result.error); return }
      if (result.cleanupPending) toast.info('Listing deleted. Some photos need another cleanup attempt; use Clean up unused photos.')
      setDeleted(prev => [...prev, confirmId]); setConfirmId(null)
    } catch { setDeleteError('Could not delete this listing. Please try again.') }
    finally { setDeleting(false) }
  }

  return <div className="vx-page">
    <PageHeading eyebrow="Your catalog" title="Your listings" description="A well-stocked store starts with the little details." actions={<Link href="/vendor/listings/new" className="vx-btn"><Plus size={17} />New Listing</Link>} />
    {notice && <div className="vx-notice" role="status"><CheckCircle2 size={17} />{notice === 'created' ? 'Listing created.' : 'Changes saved.'}<button onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={16} /></button></div>}
    <div className="vx-listing-summary" aria-label="Listing summary"><div className="vx-summary-item"><span>Published listings</span><strong>{counts.active}</strong></div><div className="vx-summary-item"><span>Saved drafts</span><strong>{counts.draft}</strong></div><div className="vx-summary-item"><span>Low or out of stock</span><strong>{lowCount}</strong></div></div>
    <div className="vx-toolbar"><div className="vx-filters" aria-label="Listing status">{(['all', 'active', 'draft'] as const).map(f => <button key={f} className="vx-filter" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All listings' : f === 'active' ? 'Active' : 'Drafts'}<span>{counts[f]}</span></button>)}</div><div className="vx-toolbar-controls"><label className="vx-search"><Search size={15} /><input type="search" aria-label="Search your listings" placeholder="Search listings…" value={query} onChange={e => setQuery(e.target.value)} /></label><select className="vx-select" aria-label="Stock filter" value={stock} onChange={e => setStock(e.target.value as Stock)}><option value="all">All stock</option><option value="low">Low or out of stock</option><option value="out">Out of stock</option></select><select className="vx-select" aria-label="Sort listings" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="newest">Newest first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="stock">Stock: low to high</option></select></div></div>
    <p className="vx-results-count" role="status">{filtered.length} {filtered.length === 1 ? 'listing' : 'listings'} shown</p>
    {!filtered.length ? <div className="vx-panel"><EmptyState title={items.length ? 'No listings match these filters' : 'Your first listing starts here'} action={items.length ? <button className="vx-btn vx-btn-secondary" onClick={() => { setFilter('all'); setStock('all'); setQuery('') }}>Clear filters</button> : <Link className="vx-btn" href="/vendor/listings/new"><Plus size={16} />Create a Listing</Link>}>{items.length ? 'Try another search or clear your filters to see your catalog.' : 'Add your photos, set a price, and make something available on campus.'}</EmptyState></div> : <div className="vx-listings-grid">{filtered.map(p => {
      const onSale = p.compare_at_price != null && p.compare_at_price > p.price && (!p.sale_ends_at || +new Date(p.sale_ends_at) > now)
      return <article className="vx-listing" key={p.id}><Link className="vx-listing-image" href={`/vendor/listings/${p.id}/edit`} aria-label={`Edit photos for ${p.title}`}>{p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <ImageOff size={32} strokeWidth={1.3} />}<span className={`vx-pill ${p.status}`}>{p.status === 'active' ? 'Active' : p.status === 'draft' ? 'Draft' : p.status}</span></Link><div className="vx-listing-content"><h2><Link href={`/vendor/listings/${p.id}/edit`}>{p.title}</Link></h2><div className="vx-listing-price">₦{p.price.toLocaleString('en-NG')}{onSale && <del>₦{p.compare_at_price!.toLocaleString('en-NG')}</del>}</div><div className="vx-listing-stock"><span className={p.availability === 'pre_order' ? '' : p.stock_quantity <= 0 ? 'vx-stock-out' : p.stock_quantity <= 3 ? 'vx-stock-low' : ''}>{p.availability === 'pre_order' ? 'Pre-order' : p.stock_quantity <= 0 ? 'Out of stock' : `${p.stock_quantity} in stock`}</span>{onSale && <span className="vx-pill">On sale</span>}</div></div><div className="vx-listing-actions"><Link href={`/vendor/listings/${p.id}/edit`} aria-label={`Edit ${p.title}`}><Pencil size={13} />Edit</Link>{p.status === 'active' && <Link href={`/products/${p.id}`} aria-label={`View ${p.title}`}><ArrowUpRight size={14} />View</Link>}<button aria-label={`Delete ${p.title}`} onClick={() => { setDeleteError(null); setConfirmId(p.id) }}><Trash2 size={15} /></button></div></article>
    })}</div>}
    <footer className="vx-listing-footer"><p>Keep photos tidy when you update or remove listings.</p><CleanupButton /></footer>
    <dialog ref={dialogRef} className="vx-modal" aria-labelledby="delete-listing-title" onCancel={e => { e.preventDefault(); close() }} onClose={() => { if (!deleting) setConfirmId(null) }}><h2 id="delete-listing-title">Delete this listing?</h2><p>This permanently removes the listing from your store. Use Edit to change a price, update photos, or save it as a draft instead.</p>{deleteError && <p className="vx-notice vx-danger" role="alert">{deleteError}</p>}<div className="vx-modal-actions"><button className="vx-btn vx-btn-secondary" onClick={close} disabled={deleting} autoFocus>Cancel</button><button className="vx-btn vx-btn-delete" onClick={remove} disabled={deleting}>{deleting ? <><Loader2 size={15} className="animate-spin" />Deleting…</> : 'Delete Listing'}</button></div></dialog>
  </div>
}
