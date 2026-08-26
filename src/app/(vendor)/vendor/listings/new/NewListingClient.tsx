'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ImagePlus, X, Loader2, ChevronLeft,
  AlertCircle, CheckCircle2,
} from 'lucide-react'

type Category = { id: string; name: string }

type Props = {
  sellerId: string
  categories: Category[]
}

type ImageSlot = {
  file: File
  previewUrl: string
}

const COMMISSION_RATE = 0.05 // 5% — matches CampusMart's Phase 1 commission model
const MAX_IMAGES = 5
const MAX_FILE_SIZE_MB = 5

export default function NewListingClient({ sellerId, categories }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stockQuantity, setStockQuantity] = useState('1')
  const [images, setImages] = useState<ImageSlot[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'draft' | 'active' | null>(null)

  const priceNumber = parseFloat(price) || 0
  const vendorEarnings = priceNumber * (1 - COMMISSION_RATE)

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
    const validFiles: ImageSlot[] = []

    for (const file of incoming) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`"${file.name}" is over ${MAX_FILE_SIZE_MB}MB — please use a smaller image.`)
        continue
      }
      validFiles.push({ file, previewUrl: URL.createObjectURL(file) })
    }

    setImages(prev => {
      const combined = [...prev, ...validFiles]
      return combined.slice(0, MAX_IMAGES)
    })
  }

  function removeImage(index: number) {
    setImages(prev => {
      const copy = [...prev]
      URL.revokeObjectURL(copy[index].previewUrl)
      copy.splice(index, 1)
      return copy
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }, [])

  function validate(): string | null {
    if (!title.trim()) return 'Give your listing a title.'
    if (!categoryId) return 'Select a category.'
    if (!priceNumber || priceNumber <= 0) return 'Enter a valid price.'
    if (images.length === 0) return 'Add at least one photo.'
    return null
  }

  async function handleSubmit(status: 'draft' | 'active') {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setSubmitting(status)

    try {
      const uploadedUrls: string[] = []
      for (const img of images) {
        const ext = img.file.name.split('.').pop()
        const path = `${sellerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, img.file)

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)

        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(path)

        uploadedUrls.push(publicUrlData.publicUrl)
      }

      const { data: newProduct, error: insertError } = await supabase
        .from('products')
        .insert({
          seller_id: sellerId,
          title: title.trim(),
          description: description.trim() || null,
          category_id: categoryId,
          price: priceNumber,
          stock_quantity: parseInt(stockQuantity) || 1,
          images: uploadedUrls,
          status,
        })
        .select('id')
        .single()

      if (insertError) throw new Error(insertError.message)

      router.push(`/vendor/listings?created=${newProduct.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.')
      setSubmitting(null)
    }
  }
    return (
    <>
      <style>{`
        .nl-shell {
          max-width: 720px;
          margin: 0 auto;
          padding-bottom: 100px;
        }

        .nl-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-dm-sans);
          font-size: 0.85rem; font-weight: 500;
          color: var(--vs-muted, #64748b);
          text-decoration: none;
          margin-bottom: 18px;
          transition: color 0.15s;
        }
        .nl-back:hover { color: #2563eb; }

        .nl-header { margin-bottom: 24px; }
        .nl-title {
          font-family: var(--font-sora); font-size: 1.5rem; font-weight: 700;
          color: var(--vs-heading, #fff); margin: 0 0 4px;
        }
        .nl-subtitle {
          font-family: var(--font-dm-sans); font-size: 0.88rem;
          color: var(--vs-muted, #64748b); margin: 0;
        }

        .nl-section {
          background: var(--vs-bg, #0f1a35);
          border: 1px solid var(--vs-border, #1e3a5f);
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .nl-section-title {
          font-family: var(--font-sora); font-size: 0.8rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: #2563eb; margin: 0 0 16px;
        }

        .nl-field { margin-bottom: 16px; }
        .nl-field:last-child { margin-bottom: 0; }
        .nl-label {
          display: block; font-family: var(--font-dm-sans);
          font-size: 0.82rem; font-weight: 600;
          color: var(--vs-heading, #e2e8f0); margin-bottom: 6px;
        }
        .nl-hint {
          font-family: var(--font-dm-sans); font-size: 0.72rem;
          color: var(--vs-muted, #64748b); margin-top: 4px;
        }

        .nl-input, .nl-textarea, .nl-select {
          width: 100%;
          font-family: var(--font-dm-sans); font-size: 0.9rem;
          color: var(--vs-heading, #fff);
          background: var(--nl-input-bg, #060d1f);
          border: 1.5px solid var(--vs-border, #1e3a5f);
          border-radius: 9px;
          padding: 10px 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .nl-input:focus, .nl-textarea:focus, .nl-select:focus {
          border-color: #2563eb;
        }
        .nl-textarea { resize: vertical; min-height: 90px; max-height: 200px; }

        .nl-price-wrap { position: relative; }
        .nl-price-prefix {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          font-family: var(--font-dm-sans); font-weight: 700; font-size: 0.9rem;
          color: #2563eb; pointer-events: none;
        }
        .nl-price-wrap .nl-input { padding-left: 30px; }

        .nl-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .nl-earnings {
          margin-top: 10px; padding: 10px 14px;
          background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.25);
          border-radius: 9px;
          font-family: var(--font-dm-sans); font-size: 0.78rem;
          color: var(--vs-muted, #94a3b8);
          display: flex; justify-content: space-between; align-items: center;
        }
        .nl-earnings strong { color: #4ade80; font-size: 0.85rem; }

        .nl-dropzone {
          border: 1.5px dashed var(--vs-border, #1e3a5f);
          border-radius: 12px;
          padding: 28px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .nl-dropzone:hover, .nl-dropzone.dragging {
          border-color: #2563eb; background: rgba(37,99,235,0.05);
        }
        .nl-dropzone-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(37,99,235,0.12); color: #2563eb;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 10px;
        }
        .nl-dropzone-text {
          font-family: var(--font-dm-sans); font-size: 0.85rem; font-weight: 600;
          color: var(--vs-heading, #e2e8f0); margin: 0 0 2px;
        }
        .nl-dropzone-sub {
          font-family: var(--font-dm-sans); font-size: 0.74rem;
          color: var(--vs-muted, #64748b); margin: 0;
        }

        .nl-preview-grid {
          display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
          margin-top: 12px;
        }
        .nl-preview {
          position: relative; aspect-ratio: 1; border-radius: 9px;
          overflow: hidden; border: 1px solid var(--vs-border, #1e3a5f);
        }
        .nl-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .nl-preview-remove {
          position: absolute; top: 4px; right: 4px;
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(0,0,0,0.65); color: white;
          display: flex; align-items: center; justify-content: center;
          border: none; cursor: pointer;
        }
        .nl-preview-remove:hover { background: #ef4444; }

        .nl-error {
          display: flex; align-items: center; gap: 8px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          color: #f87171; padding: 10px 14px; border-radius: 9px;
          font-family: var(--font-dm-sans); font-size: 0.82rem;
          margin-bottom: 16px;
        }

        .nl-footer {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: var(--vs-topbar-bg, var(--navbar-bg, #0f1a35));
          border-top: 1px solid var(--vs-border, #1e3a5f);
          padding: 14px 20px;
          display: flex; gap: 10px; justify-content: flex-end;
          z-index: 40;
        }
        @media (max-width: 768px) {
          .nl-footer { left: 0; padding: 12px 14px; }
          .nl-row { grid-template-columns: 1fr; }
        }

        .nl-btn {
          padding: 11px 20px; border-radius: 9px;
          font-family: var(--font-dm-sans); font-size: 0.85rem; font-weight: 600;
          cursor: pointer; border: none;
          display: flex; align-items: center; gap: 8px;
          transition: all 0.15s;
        }
        .nl-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .nl-btn-draft {
          background: transparent; border: 1.5px solid var(--vs-border, #1e3a5f);
          color: var(--vs-heading, #e2e8f0);
        }
        .nl-btn-draft:hover:not(:disabled) { border-color: #64748b; }
        .nl-btn-publish { background: #2563eb; color: white; }
        .nl-btn-publish:hover:not(:disabled) { background: #1d4ed8; }

        html.light .nl-section { background: #ffffff; border-color: #e2e8f0; }
        html.light .nl-label { color: #1e293b; }
        html.light .nl-input, html.light .nl-textarea, html.light .nl-select {
          background: #f8fafc; border-color: #e2e8f0; color: #0f172a;
        }
        html.light .nl-dropzone { border-color: #e2e8f0; }
        html.light .nl-dropzone-text { color: #1e293b; }
        html.light .nl-footer { background: #ffffff; border-color: #e2e8f0; }
        html.light .nl-btn-draft { border-color: #e2e8f0; color: #1e293b; }
      `}</style>

      <div className="nl-shell">
        <a href="/vendor/listings" className="nl-back">
          <ChevronLeft size={15} /> Back to listings
        </a>

        <div className="nl-header">
          <h1 className="nl-title">Create a new listing</h1>
          <p className="nl-subtitle">Add a product for students to discover on CampusMart.</p>
        </div>

        {error && (
          <div className="nl-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="nl-section">
          <p className="nl-section-title">Core Information</p>

          <div className="nl-field">
            <label className="nl-label" htmlFor="title">Title</label>
            <input
              id="title"
              autoFocus
              type="text"
              className="nl-input"
              placeholder="e.g. TI-84 Plus Calculator, barely used"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="nl-field">
            <label className="nl-label" htmlFor="category">Category</label>
            <select
              id="category"
              className="nl-select"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            >
              <option value="">Select a category…</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="nl-field">
            <label className="nl-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              className="nl-textarea"
              placeholder="Describe the item's condition, why you're selling it, and anything a buyer should know."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="nl-section">
          <p className="nl-section-title">Media &amp; Inventory</p>

          <div className="nl-field">
            <label className="nl-label">Product Photos</label>
            <div
              className={`nl-dropzone${isDragging ? ' dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="nl-dropzone-icon"><ImagePlus size={20} /></div>
              <p className="nl-dropzone-text">Drag photos here, or click to browse</p>
              <p className="nl-dropzone-sub">Up to {MAX_IMAGES} images · JPG or PNG · max {MAX_FILE_SIZE_MB}MB each</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={e => e.target.files && addFiles(e.target.files)}
              />
            </div>

            {images.length > 0 && (
              <div className="nl-preview-grid">
                {images.map((img, i) => (
                  <div className="nl-preview" key={img.previewUrl}>
                    <img src={img.previewUrl} alt={`Upload ${i + 1}`} />
                    <button
                      type="button"
                      className="nl-preview-remove"
                      onClick={() => removeImage(i)}
                      aria-label={`Remove image ${i + 1}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="nl-row">
            <div className="nl-field">
              <label className="nl-label" htmlFor="price">Price (₦)</label>
              <div className="nl-price-wrap">
                <span className="nl-price-prefix">₦</span>
                <input
                  id="price"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className="nl-input"
                  placeholder="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="nl-field">
              <label className="nl-label" htmlFor="stock">Stock Quantity</label>
              <input
                id="stock"
                type="number"
                inputMode="numeric"
                min="1"
                className="nl-input"
                value={stockQuantity}
                onChange={e => setStockQuantity(e.target.value)}
              />
            </div>
          </div>

          {priceNumber > 0 && (
            <div className="nl-earnings">
              <span>You'll earn (after 5% commission)</span>
              <strong>₦{vendorEarnings.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</strong>
            </div>
          )}
        </div>

        <div className="nl-section">
          <p className="nl-section-title">Listing Control</p>
          <p className="nl-hint" style={{ marginTop: 0 }}>
            Use the buttons below to save this as a private draft, or publish it live for students to see right away.
          </p>
        </div>
      </div>

      <div className="nl-footer">
        <button
          className="nl-btn nl-btn-draft"
          onClick={() => handleSubmit('draft')}
          disabled={submitting !== null}
        >
          {submitting === 'draft' && <Loader2 size={15} className="animate-spin" />}
          Save as Draft
        </button>
        <button
          className="nl-btn nl-btn-publish"
          onClick={() => handleSubmit('active')}
          disabled={submitting !== null}
        >
          {submitting === 'active' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <CheckCircle2 size={15} />
          )}
          {submitting === 'active' ? 'Publishing…' : 'Publish Listing'}
        </button>
      </div>
    </>
  )
}