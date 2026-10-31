'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { setFavorite } from '@/lib/buyer/actions'
import { useBuyerAccount } from './BuyerAccount'

export default function FavoriteButton({ productId, initialSaved = false, label = false }: { productId: string; initialSaved?: boolean; label?: boolean }) {
  const account = useBuyerAccount()
  const saved = account.vendorState === 'loading' ? initialSaved : account.favorites.includes(productId)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  async function toggle() {
    setBusy(true)
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) { router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
      const result = await setFavorite(productId, !saved)
      if ('error' in result) return void toast.error(result.error)
      account.favoriteChanged(productId, !saved)
      toast.success(saved ? 'Removed from favorites' : 'Saved to favorites')
      router.refresh()
    } catch { toast.error('Could not update favorites. Please try again.') }
    finally { setBusy(false) }
  }
  return <button type="button" className={label ? 'buyer-btn' : 'buyer-favorite'} onClick={toggle} disabled={busy} aria-pressed={saved} aria-label={saved ? 'Remove from favorites' : 'Save to favorites'} title={saved ? 'Remove from favorites' : 'Save to favorites'}>
    <Heart size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{label && (saved ? 'Saved' : 'Save listing')}
  </button>
}
