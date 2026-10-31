'use client'
import { useState, type FormEvent } from 'react'
import { submitSupport } from '@/lib/buyer/actions'
import { supportSchema } from '@/lib/buyer/validation'

export default function ContactForm({orders}:{orders:{id:string;created_at:string|null}[]}) {
  const [values,setValues]=useState({subject:'',body:'',order_id:''})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [reference,setReference]=useState('')
  async function submit(e:FormEvent) {
    e.preventDefault();setError('');setReference('')
    const parsed=supportSchema.safeParse(values)
    if(!parsed.success){setError(parsed.error.issues[0].message);return}
    setBusy(true)
    try {const r=await submitSupport(parsed.data);if('error'in r)setError(r.error);else {setReference(r.id);setValues({subject:'',body:'',order_id:''})}}
    catch {setError('Could not send your request. Your draft is still here.')}
    finally {setBusy(false)}
  }
  return <form className="buyer-form" onSubmit={submit}>
    <label>Subject<input className="buyer-input" required minLength={5} maxLength={120} value={values.subject} onChange={(e)=>setValues({...values,subject:e.target.value})}/></label>
    <label>Related order (optional)<select className="buyer-input" value={values.order_id} onChange={(e)=>setValues({...values,order_id:e.target.value})}><option value="">Not about an order</option>{orders.map((o)=><option value={o.id} key={o.id}>{o.id.slice(0,8).toUpperCase()}</option>)}</select></label>
    <label>What happened?<textarea className="buyer-input" required minLength={20} maxLength={4000} value={values.body} onChange={(e)=>setValues({...values,body:e.target.value})}/></label>
    {error&&<p className="buyer-notice is-error" role="alert">{error}</p>}{reference&&<p className="buyer-notice is-success" role="status">Request sent. Your reference is {reference.slice(0,8).toUpperCase()}. Responses will appear below.</p>}
    <div><button className="buyer-btn is-primary" disabled={busy}>{busy?'Sending?':'Send request'}</button></div>
  </form>
}
