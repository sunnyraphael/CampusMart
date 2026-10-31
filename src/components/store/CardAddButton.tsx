'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/store/cart'
import { toast } from 'sonner'

// The only interactive piece of a product card that needs the browser (it talks to the cart store).
// Everything else on the card stays a server component, so the list ships very little JavaScript.
type Props = {
  id: string
  title: string
  price: number
  imageUrl: string | null
  vendorName: string | null
  stock: number
}

export default function CardAddButton({ id, title, price, imageUrl, vendorName, stock }: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const [added, setAdded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear the timer if the card unmounts before the 2 seconds are up.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function handleClick() {
    const existing = useCartStore.getState().items.find((item) => item.id === id)?.quantity ?? 0
    if (existing >= stock) { toast.error(stock > 0 ? 'All available stock is already in your cart.' : 'This item is out of stock.'); return }
    addItem({ id, title, price, quantity: 1, image_url: imageUrl, vendor_name: vendorName })
    setAdded(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 2000)
  }

  return (
    <button type="button" className={`pc-add${added ? ' is-added' : ''}`} onClick={handleClick} disabled={stock <= 0}
      aria-label={`Add ${title} to cart`} title={added ? 'Added to cart' : 'Add to cart'}>
      {added ? <Check size={20} strokeWidth={2} aria-hidden="true" /> : <ShoppingCart size={20} strokeWidth={1.75} aria-hidden="true" />}
      <span className="pc-add-label" aria-hidden="true">{stock <= 0 ? 'Out of stock' : added ? 'Added' : 'Add to cart'}</span>
      {/* Mobile uses the icon; desktop also shows the label. */}
      <span className="sr-only" role="status">{added ? `${title} added to cart` : ''}</span>
    </button>
  )
}
