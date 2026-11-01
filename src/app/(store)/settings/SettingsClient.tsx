'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme/ThemeProvider'
import { createClient } from '@/lib/supabase/client'
import { passwordSchema } from '@/lib/buyer/validation'
import Link from 'next/link'
import { Palette, KeyRound, ShieldCheck, ArrowUpRight } from 'lucide-react'

export default function SettingsClient({email}:{email:string}) {
  const {theme,setTheme}=useTheme()
  const router=useRouter()
  const [current,setCurrent]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState({error:'',ok:''})
  async function changePassword(e:FormEvent) {
    e.preventDefault();setStatus({error:'',ok:''})
    const parsed=passwordSchema.safeParse(password)
    if (!parsed.success || password!==confirm) {setStatus({error:parsed.success?'The new passwords do not match.':parsed.error.issues[0].message,ok:''});return}
    setBusy(true)
    try {
      const supabase=createClient()
      const verified=await supabase.auth.signInWithPassword({email,password:current})
      if (verified.error) {setStatus({error:'Your current password could not be verified. Use Forgot password if you sign in with Google.',ok:''});return}
      const {error}=await supabase.auth.updateUser({password})
      if(error) setStatus({error:error.message,ok:''})
      else {setCurrent('');setPassword('');setConfirm('');setStatus({error:'',ok:'Your password has been updated.'})}
    } catch {setStatus({error:'Could not update your password. Please try again.',ok:''})} finally {setBusy(false)}
  }
  async function signOut() {
    setBusy(true)
    try {const {error}=await createClient().auth.signOut();if(error) throw error;router.replace('/');router.refresh()}
    catch {setStatus({error:'Could not sign out. Please try again.',ok:''});setBusy(false)}
  }
  return <>
    <div className="ac-settings-summary">Signed in as <strong>{email}</strong>. Account preferences and security are managed here.</div>
    <div className="ac-settings"><section className="buyer-panel"><div className="ac-settings-title"><Palette size={21} aria-hidden/><h2>Appearance</h2></div><label className="buyer-label">Theme<select className="buyer-input" value={theme} onChange={(e)=>setTheme(e.target.value as 'light'|'dark'|'system')}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label><p className="buyer-help">This preference is saved on this device.</p></section>
    <section className="buyer-panel ac-password"><div className="ac-settings-title"><KeyRound size={21} aria-hidden/><h2>Change password</h2></div><form className="buyer-form" onSubmit={changePassword}>
      <label>Current password<input className="buyer-input" type="password" autoComplete="current-password" value={current} onChange={(e)=>setCurrent(e.target.value)} required/></label>
      <label>New password<input className="buyer-input" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(e)=>setPassword(e.target.value)} required/></label>
      <label>Confirm new password<input className="buyer-input" type="password" autoComplete="new-password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} required/></label>
      <div><button className="buyer-btn is-primary" disabled={busy}>{busy?'Please wait…':'Update password'}</button></div>
    </form></section><section className="buyer-panel" id="privacy-controls"><div className="ac-settings-title"><ShieldCheck size={21} aria-hidden/><h2>Data and privacy</h2></div><p className="buyer-help">Review your privacy choices, request eligible data removal or close your account or store. You choose which action to take.</p><div className="buyer-actions"><Link className="buyer-btn is-primary" href="/settings/account">Account controls <ArrowUpRight size={15} aria-hidden/></Link><Link className="buyer-btn" href="/consent">Account permissions</Link><Link className="buyer-btn" href="/guardian-permission">Guardian permission</Link><button className="buyer-btn" onClick={()=>window.dispatchEvent(new Event('campusmart:cookie-preferences'))}>Cookie preferences</button></div></section></div>
    {status.error&&<p className="buyer-notice is-error" role="alert">{status.error}</p>}{status.ok&&<p className="buyer-notice is-success" role="status">{status.ok}</p>}
    <div className="ac-settings-footer" id="account-controls"><p>Signing out keeps your account and store open.<br/>To close either one, use Account controls.</p><button className="buyer-btn" disabled={busy} onClick={signOut}>Sign out of this device</button></div>
  </>
}
