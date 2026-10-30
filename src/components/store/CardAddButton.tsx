'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/store/cart'

// The only interactive piece of a product card that needs the browser (it talks to the cart store).
// Everything else on the card stays a server component, so the list ships very little JavaScript.
type Props = {
  id: string
  title: string
  price: number
  imageUrl: string | null
  vendorName: string | null
}

export default function CardAddButton({ id, title, price, imageUrl, vendorName }: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const [added, setAdded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear the timer if the card unmounts before the 2 seconds are up.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function handleClick() {
    addItem({ id, title, price, quantity: 1, image_url: imageUrl, vendor_name: vendorName })
    setAdded(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 2000)
  }

  return (
    <button type="button" className={`pc-add${added ? ' is-added' : ''}`} onClick={handleClick}>
      {added ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <ShoppingCart size={16} strokeWidth={1.75} aria-hidden="true" />}
      <span>{added ? 'Added' : 'Add to cart'}</span>
      {/* Screen readers hear the change; sighted users see the button text change. */}
      <span className="sr-only" role="status">{added ? `${title} added to cart` : ''}</span>
    </button>
  )
}