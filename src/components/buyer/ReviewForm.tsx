'use client'
import {useId,useState,type FormEvent} from 'react'
import {Star} from 'lucide-react'
import {reviewProduct} from '@/lib/buyer/actions'

export default function ReviewForm({productId,rating:initial=0,comment:initialComment='',onSaved}:{productId:string;rating?:number;comment?:string;onSaved?:()=>void}){
 const name=useId(),[rating,setRating]=useState(initial),[comment,setComment]=useState(initialComment),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return
  if(!Number.isInteger(rating)||rating<1||rating>5){setError('Choose a rating from 1 to 5 stars.');return}
  setBusy(true);setError('');setSaved(false)
  try{const result=await reviewProduct(productId,rating,comment);if('error'in result)setError(result.error);else{setSaved(true);onSaved?.()}}
  catch{setError('Your review could not be confirmed. Retry to update the same review; a second review will not be added.')}
  finally{setBusy(false)}
 }
 return <form className="buyer-form review-form" method="post" onSubmit={submit}><h3>{initial?'Edit your review':'Review your purchase'}</h3><p className="buyer-help">Rate this item honestly. Your review is optional and does not affect delivery approval or refunds.</p>
 <fieldset disabled={busy} className="review-rating"><legend>Rating</legend><div className="review-stars" role="radiogroup" aria-label="Rating">{[1,2,3,4,5].map(n=><label className="review-star-option" key={n}><input type="radio" name={name} value={n} checked={rating===n} onChange={()=>{setRating(n);setSaved(false)}} required aria-label={n+' '+(n===1?'star':'stars')}/><Star size={30} aria-hidden fill={n<=rating?'currentColor':'none'}/></label>)}</div><p className="buyer-help" aria-live="polite">{rating?rating+' out of 5 stars':'Choose 1 to 5 stars'}</p></fieldset>
 <div className="review-comment"><label htmlFor={name+'-comment'}>Your review (optional)</label><textarea id={name+'-comment'} className="buyer-input" maxLength={2000} disabled={busy} value={comment} onChange={e=>{setComment(e.target.value);setSaved(false)}} placeholder="How was the item?" rows={4}/></div>
 {error&&<p className="buyer-notice is-error" role="alert">{error}</p>}{saved&&<p className="buyer-notice is-success" role="status">Thank you. Your review has been saved for this item.</p>}
 <div><button className="buyer-btn is-primary" disabled={busy||rating<1}>{busy?'Saving...':initial?'Update review':'Save review'}</button></div></form>
}
