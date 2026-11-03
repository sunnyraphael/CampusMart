'use client'
import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import ReviewForm from '@/components/buyer/ReviewForm'
import type {PurchaseReview} from '@/lib/buyer/purchase-reviews'
export type ReviewPurchase={productId:string;title:string;existing?:PurchaseReview}
export default function ReceiptReview({purchase,autoOpen=false}:{purchase:ReviewPurchase;autoOpen?:boolean}){
 const [open,setOpen]=useState(autoOpen),[saved,setSaved]=useState(false),dialog=useRef<HTMLDialogElement>(null)
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal()},[open])
 return <section className="receipt-review" aria-label={'Review '+purchase.title}><div className="buyer-row"><div><strong>{saved||purchase.existing?'Your item review':'How was your item?'}</strong><p className="buyer-help">{saved||purchase.existing?'You can update your rating and message.':'Share a rating to help other buyers. You can do this later.'}</p></div><button className="buyer-btn" onClick={()=>setOpen(true)}>{saved||purchase.existing?'Edit review':'Rate this item'}</button></div>
 {open&&<dialog ref={dialog} className="receipt-review-dialog" aria-labelledby={'review-title-'+purchase.productId} onCancel={e=>{e.preventDefault();setOpen(false)}}><h2 id={'review-title-'+purchase.productId}>{purchase.title}</h2><ReviewForm productId={purchase.productId} rating={purchase.existing?.rating} comment={purchase.existing?.comment??''} onSaved={()=>setSaved(true)}/><div className="buyer-actions"><button type="button" className="buyer-btn" onClick={()=>setOpen(false)}>{saved?'Close':'Not now'}</button><Link className="buyer-btn" href={'/products/'+purchase.productId+'#reviews'}>Read item reviews</Link></div></dialog>}
 </section>
}
