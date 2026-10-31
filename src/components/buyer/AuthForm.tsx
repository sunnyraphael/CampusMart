'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { passwordSchema, safeRedirect } from '@/lib/buyer/validation'

export default function AuthForm({mode,next='/',vendor=false,initialError=''}:{mode:'login'|'register'|'forgot'|'reset';next?:string;vendor?:boolean;initialError?:string}) {
  const router=useRouter()
  const [form,setForm]=useState({name:'',email:'',password:'',confirm:'',role:vendor?'vendor':'buyer'})
  const [show,setShow]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState(initialError)
  const [notice,setNotice]=useState('')
  const titles={login:'Welcome back',register:'Join CampusMart',forgot:'Reset your password',reset:'Choose a new password'}
  async function submit(e:FormEvent) {
    e.preventDefault();setError('');setNotice('')
    if(mode==='register'||mode==='reset') {
      const parsed=passwordSchema.safeParse(form.password)
      if(!parsed.success){setError(parsed.error.issues[0].message);return}
      if(mode==='reset'&&form.password!==form.confirm){setError('The passwords do not match.');return}
    }
    setBusy(true)
    try {
      const supabase=createClient()
      if(mode==='login') {
        const {error}=await supabase.auth.signInWithPassword({email:form.email.trim(),password:form.password})
        if(error)throw error
        router.replace(safeRedirect(next));router.refresh()
      } else if(mode==='register') {
        const destination=form.role==='vendor'?'/start-selling':safeRedirect(next)
        const {data,error}=await supabase.auth.signUp({email:form.email.trim(),password:form.password,options:{data:{full_name:form.name.trim(),role:form.role},emailRedirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`}})
        if(error)throw error
        if(data.session) {router.replace(destination);router.refresh()}
        else setNotice('Check your email for a confirmation link. If you already have an account, sign in or reset your password.')
      } else if(mode==='forgot') {
        const {error}=await supabase.auth.resetPasswordForEmail(form.email.trim(),{redirectTo:`${window.location.origin}/auth/callback?next=%2Freset-password`})
        if(error)throw error
        setNotice('If an account exists for that address, a recovery email is on its way. Follow the link in the same browser when possible.')
      } else {
        const {data:{user}}=await supabase.auth.getUser()
        if(!user){setError('Your recovery session has expired. Request a new password reset link.');return}
        const {error}=await supabase.auth.updateUser({password:form.password})
        if(error)throw error
        setForm({...form,password:'',confirm:''});setNotice('Your password has been updated. You can return to your account.')
      }
    } catch(e) {setError(e instanceof Error?e.message:'Please try again in a moment.')}
    finally {setBusy(false)}
  }
  async function google() {
    setBusy(true);setError('')
    try {
      const params=new URLSearchParams({next:safeRedirect(next)})
      if(mode==='register'&&form.role==='vendor')params.set('role','vendor')
      const {error}=await createClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/auth/callback?${params}`}})
      if(error)throw error
    } catch {setError('Google sign-in could not start. Please try again.');setBusy(false)}
  }
  return <section className="buyer-auth buyer-panel buyer-stack"><ShoppingBag size={28} aria-hidden="true"/><h1>{titles[mode]}</h1>
    <p className="buyer-help">{mode==='login'?'Sign in to your orders, favorites and messages.':mode==='register'?'Buy and sell with students on your campus.':mode==='forgot'?'Enter the email address you use on CampusMart.':'Use at least 8 characters and choose a password you do not use elsewhere.'}</p>
    <form className="buyer-form" onSubmit={submit}>
      {mode==='register'&&<><label>Full name<input className="buyer-input" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required minLength={2} maxLength={100} autoComplete="name"/></label><label>I want to<select className="buyer-input" value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})}><option value="buyer">Shop on CampusMart</option><option value="vendor">Open a vendor store</option></select></label></>}
      {mode!=='reset'&&<label>Email address<input className="buyer-input" type="email" autoComplete="email" required value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label>}
      {mode!=='forgot'&&<label>{mode==='reset'?'New password':'Password'}<div className="buyer-password"><input className="buyer-input" type={show?'text':'password'} required autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:8} maxLength={128} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})}/><button type="button" onClick={()=>setShow(!show)} aria-label={show?'Hide password':'Show password'} aria-pressed={show}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>}
      {mode==='reset'&&<label>Confirm new password<input className="buyer-input" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e)=>setForm({...form,confirm:e.target.value})}/></label>}
      {error&&<p className="buyer-notice is-error" role="alert">{error}</p>}{notice&&<p className="buyer-notice is-success" role="status">{notice}</p>}
      <button className="buyer-btn is-primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':mode==='register'?'Create account':mode==='forgot'?'Send recovery link':'Update password'}</button>
    </form>
    {(mode==='login'||mode==='register')&&<button className="buyer-btn" disabled={busy} onClick={google}>Continue with Google</button>}
    <div className="buyer-actions">{mode==='login'?<><Link href={`/register?redirectTo=${encodeURIComponent(safeRedirect(next))}`}>Create account</Link><Link href="/forgot-password">Forgot password?</Link></>:mode==='reset'?<><Link href="/profile">Go to account</Link><Link href="/forgot-password">Request a new link</Link></>:<Link href="/login">Back to sign in</Link>}</div>
    {error&&<Link href="/contact">Contact support</Link>}
  </section>
}
