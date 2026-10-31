'use client'
import { useState, type FormEvent } from 'react'
import { updateProfile } from '@/lib/buyer/actions'
import { profileSchema } from '@/lib/buyer/validation'
import { useBuyerAccount } from '@/components/buyer/BuyerAccount'

export default function ProfileForm({name,phone,email}:{name:string;phone:string;email:string}) {
  const [values,setValues]=useState({full_name:name,phone})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [saved,setSaved]=useState(false)
  const {refresh}=useBuyerAccount()
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setError('');setSaved(false)
    const parsed=profileSchema.safeParse(values)
    if (!parsed.success) {setError(parsed.error.issues[0].message);return}
    setBusy(true)
    try {const r=await updateProfile(parsed.data);if ('error' in r) setError(r.error);else {setSaved(true);refresh()}}
    catch {setError('Could not save your details. Please try again.')}
    finally {setBusy(false)}
  }
  return <form className="buyer-form" onSubmit={submit}>
    <label>Full name<input className="buyer-input" autoComplete="name" value={values.full_name} required maxLength={100} onChange={(e)=>setValues({...values,full_name:e.target.value})}/></label>
    <label>Phone number<input className="buyer-input" type="tel" autoComplete="tel" placeholder="08012345678" value={values.phone} maxLength={14} onChange={(e)=>setValues({...values,phone:e.target.value})}/><span className="buyer-help">Optional. Used to coordinate your orders.</span></label>
    <label>Email address<input className="buyer-input" value={email} readOnly type="email"/><span className="buyer-help">Your sign-in email. Contact support if you need help changing it.</span></label>
    {error&&<p className="buyer-notice is-error" role="alert">{error}</p>}{saved&&<p className="buyer-notice is-success" role="status">Your details have been saved.</p>}
    <div><button className="buyer-btn is-primary" disabled={busy}>{busy?'Saving…':'Save details'}</button></div>
  </form>
}
