'use client'
import { useState, type FormEvent } from 'react'
import { reviewProduct } from '@/lib/buyer/actions'

export default function ReviewForm({productId,rating:initial=0,comment:initialComment=''}:{productId:string;rating?:number;comment?:string}) {
  const [rating,setRating]=useState(initial)
  const [comment,setComment]=useState(initialComment)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [saved,setSaved]=useState(false)
  async function submit(e:FormEvent) {
    e.preventDefault();if(rating<1||rating>5){setError('Choose a rating before saving your review.');return}setBusy(true);setError('');setSaved(false)
    try {const r=await reviewProduct(productId,rating,comment);if('error'in r)setError(r.error);else setSaved(true)}
    catch {setError('Could not save your review. Please try again.')}
    finally {setBusy(false)}
  }
  return <form className="buyer-form" onSubmit={submit}><h3>Review your purchase</h3><label>Rating<select className="buyer-input" required value={rating} onChange={(e)=>setRating(Number(e.target.value))}><option value={0} disabled>Choose your rating</option>{[1,2,3,4,5].map((n)=><option value={n} key={n}>{n} {n===1?'star':'stars'}</option>)}</select></label><label>Your review (optional)<textarea className="buyer-input" maxLength={2000} value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="How was the item?"/></label>{error&&<p className="buyer-notice is-error" role="alert">{error}</p>}{saved&&<p className="buyer-notice is-success" role="status">Your review has been saved.</p>}<div><button className="buyer-btn is-primary" disabled={busy}>{busy?'Saving…':'Save review'}</button></div></form>
}
