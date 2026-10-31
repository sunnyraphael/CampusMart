'use client'
import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'

export default function ShareStoreButton({ sellerId }: { sellerId: string }) {
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState('')
  async function share() {
    const url = `${window.location.origin}/vendors/${sellerId}`
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 3000) }
    catch { setFallback(url) }
  }
  return <div className="vx-share"><button className="vx-btn vx-btn-secondary" onClick={share}>{copied ? <Check size={16} /> : <Share2 size={16} />}{copied ? 'Link copied' : 'Share store'}</button>{fallback && <label className="vx-share-fallback">Copy your store link<input value={fallback} readOnly onFocus={e => e.currentTarget.select()} /></label>}</div>
}
