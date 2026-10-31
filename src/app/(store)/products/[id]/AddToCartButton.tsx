'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { useCartStore } from '@/store/cart'
import type { ProductFull } from '@/types'

export default function AddToCartButton({product}:{product:ProductFull}) {
  const {items,addItem}=useCartStore()
  const [selected,setSelected]=useState(1)
  const existing=items.find((i)=>i.id===product.id)?.quantity??0
  const max=Math.max(0,product.stock_quantity-existing)
  const quantity=Math.min(selected,max)
  function add() {
    const current=useCartStore.getState().items.find((i)=>i.id===product.id)?.quantity??0
    if(quantity<1||current+quantity>product.stock_quantity){toast.error('There is not enough stock for that quantity.');return}
    addItem({id:product.id,title:product.title,price:product.price,quantity,image_url:product.images?.[0]??null,vendor_name:product.sellers?.store_name??null})
    toast.success('Added to your cart')
  }
  return <div className="buyer-stack"><div className="buyer-actions"><span className="buyer-help">Quantity</span><button className="buyer-btn" aria-label="Decrease quantity" disabled={quantity<=1} onClick={()=>setSelected(Math.max(1,quantity-1))}><Minus size={16}/></button><span>{quantity}</span><button className="buyer-btn" aria-label="Increase quantity" disabled={quantity>=max} onClick={()=>setSelected(quantity+1)}><Plus size={16}/></button></div>
    <button className="buyer-btn is-primary" disabled={max===0} onClick={add}><ShoppingCart size={18} aria-hidden="true"/>{product.stock_quantity<=0?'Out of stock':max===0?'All stock is in your cart':'Add to cart'}</button>
    {existing>0&&<Link className="buyer-help" href="/cart">{existing} in your cart. View cart</Link>}
  </div>
}
