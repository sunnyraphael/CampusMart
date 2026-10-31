'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cleanupListingImages } from '@/lib/vendor/actions'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  ImagePlus, X, Loader2, ChevronLeft, AlertCircle, Star,
  Copy, EyeOff, Check,
} from 'lucide-react'

export type Category = { id: string; name: string }

export type ListingInitial = {
  id: string
  title: string
  description: string | null
  category_id: string
  price: number
  stock_quantity: number
  images: string[] | null
  status: string
  compare_at_price: number | null
  sale_ends_at: string | null
  condition: string | null
  availability: string | null
  delivery_days: number | null
}

type Props = {
  mode: 'create' | 'edit'
  sellerId: string
  categories: Category[]
  initial?: ListingInitial
}

// A photo is either already stored (has a url) or freshly picked (has a File).
type PhotoSlot =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File; previewUrl: string }

const COMMISSION_RATE = 0.05
const MAX_IMAGES = 5
const MAX_FILE_SIZE_MB = 5
const BUCKET = 'product-images'

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'used_like_new', label: 'Used, like new' },
  { value: 'used_good', label: 'Used, good' },
]
const ON_CAMPUS_DAYS = [
  { value: 0, label: 'Same day' },
  { value: 1, label: '1 day' },
  { value: 2, label: '2 days' },
  { value: 3, label: '3 days' },
]
const PRE_ORDER_DAYS = [
  { value: 5, label: '5 days' },
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 21, label: '3 weeks' },
]

const fmt = (n: number) => n.toLocaleString('en-NG', { maximumFractionDigits: 0 })

// Nigeria has no daylight saving, so Lagos is always UTC+1.
function lagosDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
}

// Turns a public image URL back into its storage path so we can delete the file.

function deliveryText(availability: string, days: number) {
  if (availability === 'pre_order') return `Pre-order: ready within ${days} days of payment`
  if (days === 0) return 'Same-day delivery'
  return `Delivery within ${days} ${days === 1 ? 'day' : 'days'} of payment`
}

export default function ListingForm({ mode, sellerId, categories, initial }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const isEdit = mode === 'edit'

  const [title, setTitle] = useState(initial?.title ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [condition, setCondition] = useState(initial?.condition ?? 'new')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')
  const [promoOn, setPromoOn] = useState(initial?.compare_at_price != null)
  const [compareAt, setCompareAt] = useState(
    initial?.compare_at_price != null ? String(initial.compare_at_price) : ''
  )
  const [saleEnds, setSaleEnds] = useState(
    initial?.sale_ends_at ? lagosDay(initial.sale_ends_at) : ''
  )
  const [stockQuantity, setStockQuantity] = useState(
    initial ? String(initial.stock_quantity) : '1'
  )
  const [availability, setAvailability] = useState(initial?.availability ?? 'on_campus')
  const [deliveryDays, setDeliveryDays] = useState(initial?.delivery_days ?? 2)

  const [photos, setPhotos] = useState<PhotoSlot[]>(() =>
    (initial?.images ?? []).map(url => ({ kind: 'existing' as const, url }))
  )
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'draft' | 'active' | 'duplicate' | null>(null)

  const priceNumber = parseFloat(price) || 0
  const compareNumber = parseFloat(compareAt) || 0
  const stockNumber = Number.parseInt(stockQuantity, 10)
  const promoActive = promoOn && priceNumber > 0 && compareNumber > priceNumber
  const percentOff = promoActive
    ? Math.round(((compareNumber - priceNumber) / compareNumber) * 100)
    : 0
  const vendorEarnings = priceNumber * (1 - COMMISSION_RATE)
  const dayOptions = availability === 'pre_order' ? PRE_ORDER_DAYS : ON_CAMPUS_DAYS

  function showError(message: string) {
    setError(message)
    requestAnimationFrame(() =>
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    )
  }

  function chooseAvailability(next: 'on_campus' | 'pre_order') {
    if (next === availability) return
    setAvailability(next)
    setDeliveryDays(next === 'pre_order' ? 14 : 2) // sensible default for each mode
  }

  function addFiles(fileList: FileList | File[]) {
    const accepted: PhotoSlot[] = []
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        showError(`"${file.name}" is over ${MAX_FILE_SIZE_MB}MB. Please use a smaller image.`)
        continue
      }
      accepted.push({ kind: 'new', file, previewUrl: URL.createObjectURL(file) })
    }
    setPhotos(prev => [...prev, ...accepted].slice(0, MAX_IMAGES))
  }

  function removePhoto(index: number) {
    const slot = photos[index]
    if (slot.kind === 'new') URL.revokeObjectURL(slot.previewUrl)
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  function makeCover(index: number) {
    setPhotos(prev => {
      const copy = [...prev]
      const [picked] = copy.splice(index, 1)
      return [picked, ...copy]
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function validate(): string | null {
    if (!title.trim()) return 'Give your listing a title.'
    if (!categoryId) return 'Select a category.'
    if (photos.length === 0) return 'Add at least one photo.'
    if (!priceNumber || priceNumber <= 0) return 'Enter a valid price.'
    if (Number.isNaN(stockNumber) || stockNumber < 0) return 'Stock must be 0 or more.'
    if (promoOn) {
      if (!compareNumber || compareNumber <= priceNumber)
        return 'The original price must be higher than the sale price.'
      if (percentOff < 1) return 'The discount must be at least 1%.'
      if (saleEnds && saleEnds < lagosDay(new Date().toISOString()))
        return 'The sale end date cannot be in the past.'
    }
    return null
  }

  async function submit(target: 'draft' | 'active') {
    const problem = validate()
    if (problem) return showError(problem)
    setError(null)
    setBusy(target)

    const uploadedPaths: string[] = []
    try {
      const finalUrls: string[] = []
      for (const slot of photos) {
        if (slot.kind === 'existing') {
          finalUrls.push(slot.url)
          continue
        }
        const ext = slot.file.name.split('.').pop() ?? 'jpg'
        const path = `${sellerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, slot.file)
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)
        uploadedPaths.push(path)
        finalUrls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl)
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        price: priceNumber,
        stock_quantity: stockNumber,
        images: finalUrls,
        status: target,
        compare_at_price: promoOn ? compareNumber : null,
        sale_ends_at: promoOn && saleEnds ? `${saleEnds}T23:59:59+01:00` : null,
        condition,
        availability,
        delivery_days: deliveryDays,
      }

      let productId: string
      if (isEdit && initial) {
        const { data, error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', initial.id)
          .select('id')
        if (updateError) throw new Error(updateError.message)
        if (!data || data.length === 0) throw new Error('Could not save. This listing may no longer exist.')
        productId = initial.id
        const cleanup = await cleanupListingImages()
        if (cleanup.pending) toast.info('Listing saved. Unused photos can be retried from your listings page.')
      } else {
        const { data, error: insertError } = await supabase
          .from('products')
          .insert({ seller_id: sellerId, ...payload })
          .select('id')
          .single()
        if (insertError) throw new Error(insertError.message)
        productId = data.id
      }

      router.push(`/vendor/listings?${isEdit ? 'updated' : 'created'}=${productId}`)
      router.refresh()
    } catch (err: unknown) {
      // The save failed, so remove the files we just uploaded to avoid orphans.
      if (uploadedPaths.length) await supabase.storage.from(BUCKET).remove(uploadedPaths)
      showError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(null)
    }
  }

  async function duplicate() {
    if (!initial) return
    setError(null)
    setBusy('duplicate')
    const { data, error: dupError } = await supabase
      .from('products')
      .insert({
        seller_id: sellerId,
        title: `${initial.title} (copy)`.slice(0, 80),
        description: initial.description,
        category_id: initial.category_id,
        price: initial.price,
        stock_quantity: initial.stock_quantity,
        images: initial.images ?? [],
        status: 'draft',
        compare_at_price: initial.compare_at_price,
        sale_ends_at: initial.sale_ends_at,
        condition: initial.condition ?? 'new',
        availability: initial.availability ?? 'on_campus',
        delivery_days: initial.delivery_days ?? 2,
      })
      .select('id')
      .single()
    if (dupError) {
      showError(dupError.message)
      setBusy(null)
      return
    }
    router.push(`/vendor/listings/${data.id}/edit`)
  }

  const isLive = isEdit && initial?.status === 'active'
  const secondary = isLive
    ? { label: 'Unpublish', target: 'draft' as const }
    : { label: 'Save as draft', target: 'draft' as const }
  const primaryLabel = !isEdit ? 'Publish listing' : isLive ? 'Save changes' : 'Publish'

  return (
    <>
      <style>{`
        .lf-shell {
          --lf-card: var(--vs-bg, #0f1a35);
          --lf-border: var(--vs-border, #1e3a5f);
          --lf-text: var(--vs-heading, #e2e8f0);
          --lf-muted: var(--vs-muted, #8a9bb8);
          --lf-input: #060d1f;
          --lf-accent: #2563eb;
          --lf-accent-soft: rgba(37,99,235,0.12);
          --lf-good: #4ade80;
          --lf-danger: #f87171;
          --lf-danger-soft: rgba(239,68,68,0.1);
          max-width: 720px;
          margin: 0 auto;
          padding-bottom: 24px;
          font-family: var(--font-dm-sans);
        }
        html.light .lf-shell {
          --lf-card: #ffffff;
          --lf-border: #e2e8f0;
          --lf-text: #0f172a;
          --lf-muted: #64748b;
          --lf-input: #f8fafc;
          --lf-accent-soft: rgba(37,99,235,0.08);
          --lf-good: #15803d;
          --lf-danger: #dc2626;
        }

        .lf-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 0.85rem; font-weight: 500; color: var(--lf-muted);
          text-decoration: none; margin-bottom: 16px; transition: color 0.15s;
        }
        .lf-back:hover { color: var(--lf-accent); }
        .lf-back:focus-visible { outline: 2px solid var(--lf-accent); outline-offset: 3px; border-radius: 4px; }

        .lf-header { margin-bottom: 20px; }
        .lf-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .lf-title {
          font-family: var(--font-sora); font-weight: 700; margin: 0;
          font-size: clamp(1.25rem, 1.05rem + 1vw, 1.55rem); color: var(--lf-text);
        }
        .lf-pill {
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 999px; border: 1px solid var(--lf-border); color: var(--lf-muted);
        }
        .lf-pill.live { color: var(--lf-good); border-color: currentColor; }
        .lf-subtitle { font-size: 0.88rem; color: var(--lf-muted); margin: 6px 0 0; }

        .lf-section {
          background: var(--lf-card); border: 1px solid var(--lf-border);
          border-radius: 14px; padding: clamp(14px, 4vw, 20px); margin-bottom: 14px;
        }
        .lf-section-title {
          font-family: var(--font-sora); font-size: 0.76rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--lf-accent); margin: 0 0 16px;
        }

        .lf-field { margin-bottom: 16px; }
        .lf-field:last-child { margin-bottom: 0; }
        .lf-label { display: block; font-size: 0.82rem; font-weight: 600; color: var(--lf-text); margin-bottom: 6px; }
        .lf-hint { font-size: 0.74rem; color: var(--lf-muted); margin: 5px 0 0; line-height: 1.45; }

        /* 16px minimum stops iPhones zooming into the field on focus */
        .lf-input, .lf-textarea, .lf-select {
          width: 100%; font-family: inherit; font-size: 1rem; color: var(--lf-text);
          background: var(--lf-input); border: 1.5px solid var(--lf-border);
          border-radius: 9px; padding: 10px 14px; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .lf-input:focus-visible, .lf-textarea:focus-visible, .lf-select:focus-visible {
          border-color: var(--lf-accent); box-shadow: 0 0 0 3px var(--lf-accent-soft);
        }
        .lf-textarea { resize: vertical; min-height: 96px; max-height: 220px; }

        .lf-money { position: relative; }
        .lf-money-sign {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          font-weight: 700; color: var(--lf-accent); pointer-events: none;
        }
        .lf-money .lf-input { padding-left: 32px; }

        .lf-row { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }

        /* Segmented choices and chips */
        .lf-choices { display: flex; flex-wrap: wrap; gap: 8px; }
        .lf-choice {
          font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer;
          color: var(--lf-text); background: transparent;
          border: 1.5px solid var(--lf-border); border-radius: 9px;
          padding: 9px 14px; min-height: 40px; transition: border-color 0.15s, background 0.15s, color 0.15s;
        }
        .lf-choice:hover { border-color: var(--lf-accent); }
        .lf-choice[aria-checked="true"] {
          background: var(--lf-accent); border-color: var(--lf-accent); color: #fff;
        }
        .lf-choice:focus-visible { outline: 2px solid var(--lf-accent); outline-offset: 2px; }

        .lf-cards { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); }
        .lf-card-choice {
          font-family: inherit; text-align: left; cursor: pointer; color: var(--lf-text);
          background: transparent; border: 1.5px solid var(--lf-border); border-radius: 12px;
          padding: 14px; transition: border-color 0.15s, background 0.15s;
        }
        .lf-card-choice:hover { border-color: var(--lf-accent); }
        .lf-card-choice[aria-checked="true"] { border-color: var(--lf-accent); background: var(--lf-accent-soft); }
        .lf-card-choice:focus-visible { outline: 2px solid var(--lf-accent); outline-offset: 2px; }
        .lf-card-choice strong { display: block; font-size: 0.9rem; margin-bottom: 3px; }
        .lf-card-choice span { display: block; font-size: 0.76rem; color: var(--lf-muted); line-height: 1.4; }

        /* Switch */
        .lf-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .lf-switch {
          flex: none; width: 44px; height: 26px; border-radius: 999px; cursor: pointer; padding: 0;
          background: var(--lf-border); border: none; position: relative; transition: background 0.15s;
        }
        .lf-switch::after {
          content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px;
          border-radius: 50%; background: #fff; transition: transform 0.15s ease-out;
        }
        .lf-switch[aria-checked="true"] { background: var(--lf-accent); }
        .lf-switch[aria-checked="true"]::after { transform: translateX(18px); }
        .lf-switch:focus-visible { outline: 2px solid var(--lf-accent); outline-offset: 3px; }

        .lf-promo-body { margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--lf-border); }

        .lf-preview {
          margin-top: 14px; padding: 12px 14px; border-radius: 10px;
          background: var(--lf-accent-soft); border: 1px solid var(--lf-border);
        }
        .lf-preview-label { display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--lf-muted); margin-bottom: 6px; }
        .lf-preview-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .lf-preview-price { font-family: var(--font-sora); font-size: 1.4rem; font-weight: 700; color: var(--lf-text); }
        .lf-badge { font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: var(--lf-accent); color: #fff; }
        .lf-preview-old { display: block; font-size: 0.9rem; color: var(--lf-muted); text-decoration: line-through; margin-top: 2px; }
        .lf-earn { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-top: 10px; font-size: 0.78rem; color: var(--lf-muted); }
        .lf-earn strong { color: var(--lf-good); font-size: 0.9rem; white-space: nowrap; }

        .lf-summary {
          margin-top: 14px; padding: 10px 14px; border-radius: 10px; font-size: 0.82rem; font-weight: 600;
          color: var(--lf-text); background: var(--lf-accent-soft); border: 1px solid var(--lf-border);
        }

        /* Photos */
        .lf-dropzone {
          border: 1.5px dashed var(--lf-border); border-radius: 12px;
          padding: clamp(20px, 6vw, 28px) 16px; text-align: center; cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .lf-dropzone:hover, .lf-dropzone.dragging { border-color: var(--lf-accent); background: var(--lf-accent-soft); }
        .lf-dropzone:focus-visible { outline: 2px solid var(--lf-accent); outline-offset: 2px; }
        .lf-dropzone-icon {
          width: 40px; height: 40px; border-radius: 10px; margin: 0 auto 10px;
          display: flex; align-items: center; justify-content: center;
          background: var(--lf-accent-soft); color: var(--lf-accent);
        }
        .lf-dropzone-text { font-size: 0.86rem; font-weight: 600; color: var(--lf-text); margin: 0 0 2px; }
        .lf-dropzone-sub { font-size: 0.74rem; color: var(--lf-muted); margin: 0; }

        .lf-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
        @media (min-width: 600px) { .lf-photos { grid-template-columns: repeat(5, 1fr); } }
        .lf-photo { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; border: 1px solid var(--lf-border); }
        .lf-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lf-photo-btn {
          position: absolute; width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          background: rgba(10,15,30,0.78); color: #fff; transition: background 0.15s;
        }
        .lf-photo-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        .lf-photo-remove { top: 5px; right: 5px; }
        .lf-photo-remove:hover { background: #dc2626; }
        .lf-photo-cover-btn { bottom: 5px; left: 5px; }
        .lf-photo-cover-btn:hover { background: var(--lf-accent); }
        .lf-cover-tag {
          position: absolute; bottom: 5px; left: 5px; font-size: 0.66rem; font-weight: 700;
          padding: 3px 7px; border-radius: 6px; background: var(--lf-accent); color: #fff; letter-spacing: 0.03em;
        }

        .lf-error {
          display: flex; align-items: flex-start; gap: 8px; margin-bottom: 14px;
          background: var(--lf-danger-soft); border: 1px solid var(--lf-danger); color: var(--lf-danger);
          padding: 10px 14px; border-radius: 9px; font-size: 0.84rem; line-height: 1.45;
        }
        .lf-error svg { flex: none; margin-top: 2px; }

        .lf-control-text { font-size: 0.82rem; color: var(--lf-muted); margin: 0 0 12px; line-height: 1.5; }

        /* Sticky action bar: stays inside the page column so it never covers the sidebar */
        .lf-bar {
          position: sticky; bottom: 0; z-index: 20; margin-top: 8px;
          display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;
          padding: 12px clamp(12px, 3vw, 16px) calc(12px + env(safe-area-inset-bottom, 0px));
          background: var(--lf-card); border: 1px solid var(--lf-border); border-radius: 14px;
        }
        .lf-btn {
          font-family: inherit; font-size: 0.86rem; font-weight: 600; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 11px 20px; min-height: 44px; border-radius: 9px; border: 1.5px solid transparent;
          transition: background 0.15s, border-color 0.15s;
        }
        .lf-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .lf-btn:focus-visible { outline: 2px solid var(--lf-accent); outline-offset: 2px; }
        .lf-btn-ghost { background: transparent; border-color: var(--lf-border); color: var(--lf-text); }
        .lf-btn-ghost:hover:not(:disabled) { border-color: var(--lf-muted); }
        .lf-btn-primary { background: var(--lf-accent); color: #fff; }
        .lf-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        @media (max-width: 420px) { .lf-bar .lf-btn { flex: 1 1 100%; } }
      `}</style>

      <div className="lf-shell">
        <Link href="/vendor/listings" className="lf-back">
          <ChevronLeft size={15} /> Back to listings
        </Link>

        <div className="lf-header">
          <div className="lf-title-row">
            <h1 className="lf-title">{isEdit ? 'Edit listing' : 'Create a new listing'}</h1>
            {isEdit && (
              <span className={`lf-pill${isLive ? ' live' : ''}`}>{isLive ? 'Live' : 'Draft'}</span>
            )}
          </div>
          <p className="lf-subtitle">
            {isEdit
              ? 'Changes go live for students as soon as you save.'
              : 'Add a product for students to discover on CampusMart.'}
          </p>
        </div>

        <nav className="vx-form-index" aria-label="Listing sections"><a href="#details">01 · Details</a><a href="#photos">02 · Photos</a><a href="#pricing">03 · Pricing</a><a href="#stock">04 · Stock &amp; delivery</a></nav>

        {error && (
          <div className="lf-error" ref={errorRef} role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div id="details" className="lf-section">
          <p className="lf-section-title">Core information</p>

          <div className="lf-field">
            <label className="lf-label" htmlFor="lf-title">Title</label>
            <input
              id="lf-title" type="text" className="lf-input" maxLength={80}
              placeholder="e.g. TI-84 Plus Calculator, barely used"
              value={title} onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="lf-field">
            <label className="lf-label" htmlFor="lf-category">Category</label>
            <select id="lf-category" className="lf-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="lf-field">
            <span className="lf-label" id="lf-condition-label">Condition</span>
            <div className="lf-choices" role="radiogroup" aria-labelledby="lf-condition-label">
              {CONDITIONS.map(c => (
                <button
                  key={c.value} type="button" role="radio" className="lf-choice"
                  aria-checked={condition === c.value} onClick={() => setCondition(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lf-field">
            <label className="lf-label" htmlFor="lf-description">Description</label>
            <textarea
              id="lf-description" className="lf-textarea"
              placeholder="Describe the item, any flaws, and anything a buyer should know."
              value={description} onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div id="photos" className="lf-section">
          <p className="lf-section-title">Photos</p>
          <div
            className={`lf-dropzone${isDragging ? ' dragging' : ''}`}
            role="button" tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="lf-dropzone-icon"><ImagePlus size={20} /></div>
            <p className="lf-dropzone-text">Drag photos here, or tap to browse</p>
            <p className="lf-dropzone-sub">Up to {MAX_IMAGES} images, max {MAX_FILE_SIZE_MB}MB each. The first photo is the cover.</p>
            <input
              ref={fileInputRef} type="file" accept="image/*" multiple hidden
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
            />
          </div>

          {photos.length > 0 && (
            <div className="lf-photos">
              {photos.map((slot, i) => {
                const src = slot.kind === 'existing' ? slot.url : slot.previewUrl
                return (
                  <div className="lf-photo" key={src}>
                    <img src={src} alt={`Listing photo ${i + 1}`} />
                    <button type="button" className="lf-photo-btn lf-photo-remove" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}>
                      <X size={14} />
                    </button>
                    {i === 0 ? (
                      <span className="lf-cover-tag">Cover</span>
                    ) : (
                      <button type="button" className="lf-photo-btn lf-photo-cover-btn" onClick={() => makeCover(i)} aria-label={`Make photo ${i + 1} the cover`}>
                        <Star size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div id="pricing" className="lf-section">
          <p className="lf-section-title">Pricing</p>

          <div className="lf-field">
            <label className="lf-label" htmlFor="lf-price">{promoOn ? 'Sale price' : 'Price'}</label>
            <div className="lf-money">
              <span className="lf-money-sign">₦</span>
              <input
                id="lf-price" type="number" inputMode="numeric" min="0" className="lf-input"
                placeholder="0" value={price} onChange={e => setPrice(e.target.value)}
              />
            </div>
            <p className="lf-hint">This is the amount the buyer pays for the item.</p>
          </div>

          <div className="lf-switch-row">
            <div>
              <span className="lf-label" id="lf-promo-label" style={{ marginBottom: 2 }}>Run a promo</span>
              <p className="lf-hint" style={{ margin: 0 }}>Show the original price crossed out with the percent saved.</p>
            </div>
            <button
              type="button" role="switch" className="lf-switch"
              aria-checked={promoOn} aria-labelledby="lf-promo-label"
              onClick={() => setPromoOn(v => !v)}
            />
          </div>

          {promoOn && (
            <div className="lf-promo-body">
              <div className="lf-row">
                <div className="lf-field">
                  <label className="lf-label" htmlFor="lf-compare">Original price</label>
                  <div className="lf-money">
                    <span className="lf-money-sign">₦</span>
                    <input
                      id="lf-compare" type="number" inputMode="numeric" min="0" className="lf-input"
                      placeholder="0" value={compareAt} onChange={e => setCompareAt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="lf-field">
                  <label className="lf-label" htmlFor="lf-sale-end">Sale ends (optional)</label>
                  <input
                    id="lf-sale-end" type="date" className="lf-input"
                    value={saleEnds} onChange={e => setSaleEnds(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {priceNumber > 0 && (
            <div className="lf-preview" aria-live="polite">
              <span className="lf-preview-label">How buyers will see it</span>
              <div className="lf-preview-top">
                <span className="lf-preview-price">₦{fmt(priceNumber)}</span>
                {promoActive && <span className="lf-badge">{percentOff}% off</span>}
              </div>
              {promoActive && <span className="lf-preview-old">₦{fmt(compareNumber)}</span>}
              <div className="lf-earn">
                <span>You receive after the 5% commission</span>
                <strong>₦{fmt(vendorEarnings)}</strong>
              </div>
            </div>
          )}
        </div>

        <div id="stock" className="lf-section">
          <p className="lf-section-title">Stock and delivery</p>

          <div className="lf-field">
            <label className="lf-label" htmlFor="lf-stock">Stock quantity</label>
            <input
              id="lf-stock" type="number" inputMode="numeric" min="0" className="lf-input"
              value={stockQuantity} onChange={e => setStockQuantity(e.target.value)}
            />
            <p className="lf-hint">Buyers see a low stock label when 3 or fewer are left.</p>
          </div>

          <div className="lf-field">
            <span className="lf-label" id="lf-avail-label">Availability</span>
            <div className="lf-cards" role="radiogroup" aria-labelledby="lf-avail-label">
              <button type="button" role="radio" className="lf-card-choice" aria-checked={availability === 'on_campus'} onClick={() => chooseAvailability('on_campus')}>
                <strong>Item is on campus now</strong>
                <span>Ready to hand over. Delivered within 3 days at most.</span>
              </button>
              <button type="button" role="radio" className="lf-card-choice" aria-checked={availability === 'pre_order'} onClick={() => chooseAvailability('pre_order')}>
                <strong>Item must be brought in</strong>
                <span>Sold as a pre-order. Up to 3 weeks to get it to campus.</span>
              </button>
            </div>
          </div>

          <div className="lf-field">
            <span className="lf-label" id="lf-days-label">
              {availability === 'pre_order' ? 'Ready within' : 'Deliver within'}
            </span>
            <div className="lf-choices" role="radiogroup" aria-labelledby="lf-days-label">
              {dayOptions.map(d => (
                <button
                  key={d.value} type="button" role="radio" className="lf-choice"
                  aria-checked={deliveryDays === d.value} onClick={() => setDeliveryDays(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="lf-hint">Counted in calendar days, Sundays included, from the time the buyer pays.</p>
          </div>

          <div className="lf-summary">{deliveryText(availability, deliveryDays)}</div>
        </div>

        {isEdit && (
          <div className="lf-section">
            <p className="lf-section-title">Listing control</p>
            <p className="lf-control-text">
              Duplicate makes a private draft copy of the last saved version, so save your changes first.
            </p>
            <button type="button" className="lf-btn lf-btn-ghost" onClick={duplicate} disabled={busy !== null}>
              {busy === 'duplicate' ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
              Duplicate listing
            </button>
          </div>
        )}

        <div className="lf-bar">
          <button type="button" className="lf-btn lf-btn-ghost" onClick={() => submit(secondary.target)} disabled={busy !== null}>
            {busy === 'draft' ? <Loader2 size={15} className="animate-spin" /> : isLive ? <EyeOff size={15} /> : null}
            {secondary.label}
          </button>
          <button type="button" className="lf-btn lf-btn-primary" onClick={() => submit('active')} disabled={busy !== null}>
            {busy === 'active' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {busy === 'active' ? 'Saving' : primaryLabel}
          </button>
        </div>
      </div>
    </>
  )
}
