'use client'
import AuthChallenge from '@/components/buyer/AuthChallenge'
import BrandMark from '@/components/BrandMark'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { passwordSchema, safeRedirect, uuid } from '@/lib/buyer/validation'

type AgeBand=''|'adult'|'under_18'
export default function AuthForm({mode,next='/',vendor=false,initialError=''}:{mode:'login'|'register'|'forgot'|'reset';next?:string;vendor?:boolean;initialError?:string}) {
  const router=useRouter()
  const [form,setForm]=useState({name:'',email:'',password:'',confirm:'',role:vendor?'vendor':'buyer'})
  const [ageBand,setAgeBand]=useState<AgeBand>('')
  const [termsAccepted,setTermsAccepted]=useState(false)
  const [guardianReference,setGuardianReference]=useState('')
  const [guardianConfirmed,setGuardianConfirmed]=useState(false)
  const [show,setShow]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState(initialError)
  const [captchaToken,setCaptchaToken]=useState('')
  const [captchaAttempt,setCaptchaAttempt]=useState(0)
  const captchaEnabled=!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY&&mode!=='reset'
  const [notice,setNotice]=useState('')
  const titles={login:'Welcome back',register:'Join CampusMart',forgot:'Reset your password',reset:'Choose a new password'}
  const approvedReference=uuid.safeParse(guardianReference.trim()).success
  const showPersonalFields=mode!=='register'||ageBand==='adult'||ageBand==='under_18'&&guardianConfirmed&&approvedReference
  const consentDestination=(destination:string)=>`/consent?next=${encodeURIComponent(safeRedirect(destination))}`
  function chooseAge(value:AgeBand) {
    setAgeBand(value);setTermsAccepted(false);setGuardianConfirmed(false);setGuardianReference('');setError('');setNotice('')
    setForm(current=>({...current,name:'',email:'',password:'',confirm:''}))
  }
  async function submit(e:FormEvent) {
    e.preventDefault();if(busy)return;setError('');setNotice('')
    if(mode==='register') {
      if(!ageBand){setError('Choose your age band before entering your details.');return}
      if(!termsAccepted){setError('Read and accept the buyer terms and acknowledge the privacy policy before creating an account.');return}
      if(ageBand==='under_18'&&(!guardianConfirmed||!approvedReference)){setError('Use an approved guardian permission reference before registering.');return}
      if(form.name.trim().length<2){setError('Enter your full name.');return}
    }
    if(mode==='register'||mode==='reset') {
      const parsed=passwordSchema.safeParse(form.password)
      if(!parsed.success){setError(parsed.error.issues[0].message);return}
      if(mode==='reset'&&form.password!==form.confirm){setError('The passwords do not match.');return}
    }
    setBusy(true)
    try {
      const supabase=createClient()
      if(mode==='login') {
        const {error}=await supabase.auth.signInWithPassword({email:form.email.trim(),password:form.password,options:{captchaToken}})
        if(error)throw error
        router.replace(safeRedirect(next));router.refresh()
      } else if(mode==='register') {
        const destination=consentDestination(form.role==='vendor'?'/start-selling':safeRedirect(next))
        const {data,error}=await supabase.auth.signUp({email:form.email.trim(),password:form.password,options:{captchaToken,data:{full_name:form.name.trim(),role:form.role,age_band:ageBand,terms_accepted:true,...(ageBand==='under_18'?{guardian_request_id:guardianReference.trim()}:{})},emailRedirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`}})
        if(error)throw error
        if(data.session){router.replace(destination);router.refresh()}
        else setNotice('Check your email for a confirmation link, then review your account permissions. If you already have an account, sign in or reset your password.')
      } else if(mode==='forgot') {
        const {error}=await supabase.auth.resetPasswordForEmail(form.email.trim(),{captchaToken,redirectTo:`${window.location.origin}/auth/callback?next=%2Freset-password`})
        if(error)throw error
        setNotice('If an account exists for that address, a recovery email is on its way. Follow the link in the same browser when possible.')
      } else {
        const {data:{user}}=await supabase.auth.getUser()
        if(!user){setError('Your recovery session has expired. Request a new password reset link.');return}
        const {error}=await supabase.auth.updateUser({password:form.password})
        if(error)throw error
        setForm({...form,password:'',confirm:''});setNotice('Your password has been updated. You can return to your account.')
      }
    } catch(e){setError(e instanceof Error?e.message:'Please try again in a moment.')}
    finally{setBusy(false);if(captchaEnabled){setCaptchaToken('');setCaptchaAttempt(n=>n+1)}}
  }
  async function google() {
    if(busy)return
    if(mode!=='login'&&mode!=='register')return
    if(mode==='register'){
      if(!ageBand||!termsAccepted){setError('Choose your age band and accept the terms before Google signup.');return}
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())){setError('Enter the email address you will choose in Google. You do not need to enter a password for Google signup.');return}
      if(ageBand==='under_18'&&(!guardianConfirmed||!approvedReference)){setError('An approved guardian reference is required before Google signup.');return}
    }
    setBusy(true);setError('')
    try {
      const client=createClient()
      if(mode==='register'){
        const prepared=await client.rpc('cm_prepare_google_signup',{p_email:form.email.trim(),p_age_band:ageBand,p_accepted:true,p_guardian_request_id:ageBand==='under_18'?guardianReference.trim():null})
        if(prepared.error){setError(prepared.error.code==='P0001'?prepared.error.message:'Google signup setup is unavailable. Contact support to check the signup migration.');setBusy(false);return}
      }
      const destination=mode==='register'&&form.role==='vendor'?'/start-selling':safeRedirect(next)
      const params=new URLSearchParams({next:destination})
      const result=await client.auth.signInWithOAuth({provider:'google',options:{skipBrowserRedirect:true,redirectTo:window.location.origin+'/auth/callback?'+params,queryParams:{prompt:'select_account',...(mode==='register'?{login_hint:form.email.trim()}:{})}}})
      if(result.error||!result.data.url)throw new Error('Google unavailable')
      window.location.assign(result.data.url)
    }catch{setError('Google sign-in could not start. The site owner must enable Google in Supabase and configure its Google OAuth client.');setBusy(false)}
  }
  return <section className="buyer-auth buyer-panel buyer-stack"><BrandMark size={52}/><h1>{titles[mode]}</h1>
    <p className="buyer-help">{mode==='login'?'Sign in to your orders, favorites and messages.':mode==='register'?'Start with your age band so we can show the account permissions that apply to you.':mode==='forgot'?'Enter the email address you use on CampusMart.':'Use at least 8 characters and choose a password you do not use elsewhere.'}</p>
    <form className="buyer-form" onSubmit={submit}>
      {mode==='register'&&<><label>Age band<select className="buyer-input" value={ageBand} onChange={e=>chooseAge(e.target.value as AgeBand)} disabled={busy} required><option value="">Choose your age band</option><option value="adult">I am 18 or older</option><option value="under_18">I am under 18</option></select></label><p className="buyer-help">We ask for an age band, not your date of birth or student ID.</p>{ageBand==='under_18'&&<><div className="buyer-notice"><ShieldCheck size={19} aria-hidden/><p>Before entering your details, ask a parent or legal guardian to use <Link href="/guardian-permission">Guardian permission</Link> from their own adult account. CampusMart must review and approve their permission first. The approved reference must match the email you register with.</p></div><label>Approved guardian permission reference<input className="buyer-input" value={guardianReference} onChange={e=>{setGuardianReference(e.target.value);setGuardianConfirmed(false)}} disabled={busy} required maxLength={36} autoComplete="off" spellCheck={false} aria-describedby="guardian-reference-help"/></label><p className="buyer-help" id="guardian-reference-help">Use the 36-character reference shared by your guardian after approval. A pending request is not an approval.</p><label className="by-check"><input type="checkbox" checked={guardianConfirmed} onChange={e=>setGuardianConfirmed(e.target.checked)} required disabled={busy}/><span>My parent or legal guardian already has CampusMart approval for this reference and my registration email.</span></label><p className="buyer-help">Buying requires approved guardian permission. Your guardian must separately authorise selling before you can open a store.</p></>}</>}
      {showPersonalFields&&<>
        {mode==='register'&&<><label>Full name<input className="buyer-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} disabled={busy} required minLength={2} maxLength={100} autoComplete="name"/></label><label>I want to<select className="buyer-input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})} disabled={busy}><option value="buyer">Shop on CampusMart</option><option value="vendor">Open a vendor store</option></select></label>{form.role==='vendor'&&<p className="buyer-help">Creating an account does not open a store. You will review the separate vendor terms before enrolling.</p>}</>}
        {mode!=='reset'&&<label>Email address<input className="buyer-input" type="email" autoComplete="email" required disabled={busy} maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>}
        {mode!=='forgot'&&<label>{mode==='reset'?'New password':'Password'}<div className="buyer-password"><input className="buyer-input" type={show?'text':'password'} required disabled={busy} autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:8} maxLength={128} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button type="button" onClick={()=>setShow(!show)} disabled={busy} aria-label={show?'Hide password':'Show password'} aria-pressed={show}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>}
        {mode==='reset'&&<label>Confirm new password<input className="buyer-input" type="password" autoComplete="new-password" required disabled={busy} value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})}/></label>}
        {mode==='register'&&<label className="by-check"><input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} required disabled={busy}/><span>I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer">buyer terms of service</Link> and acknowledge the <Link href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link>.</span></label>}
      </>}
      {captchaEnabled&&<AuthChallenge key={captchaAttempt} onToken={setCaptchaToken}/>}
      {error&&<p className="buyer-notice is-error" role="alert">{error}</p>}{notice&&<p className="buyer-notice is-success" role="status">{notice}</p>}
      <button className="buyer-btn is-primary" disabled={busy||captchaEnabled&&!captchaToken||mode==='register'&&(!showPersonalFields||!termsAccepted)}>{busy?'Please wait...':mode==='login'?'Sign in':mode==='register'?'Create account':mode==='forgot'?'Send recovery link':'Update password'}</button>
    </form>
    {mode==='login'&&<><p className="buyer-help">New here? Use Create account to review your age and terms options before Google signup.</p><button className="buyer-btn" disabled={busy} onClick={google}>Continue with Google</button></>}
    {mode==='register'&&<><p className="buyer-help">For Google signup, choose your age band, accept the terms and enter the same email you will select in Google. No password is needed here. Guardian approval is checked before under-18 registration. You will confirm your account permissions after returning from Google.</p><button className="buyer-btn" disabled={busy||!showPersonalFields||!termsAccepted} onClick={google}>Sign up with Google</button></>}
    <div className="buyer-actions">{mode==='login'?<><Link href={`/register?redirectTo=${encodeURIComponent(safeRedirect(next))}`}>Create account</Link><Link href="/forgot-password">Forgot password?</Link></>:mode==='reset'?<><Link href="/profile">Go to account</Link><Link href="/forgot-password">Request a new link</Link></>:<Link href="/login">Back to sign in</Link>}</div>
    {error&&<Link href="/contact">Contact support</Link>}
  </section>
}
