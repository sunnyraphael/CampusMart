'use client'
import{useState,type FormEvent}from'react'
import AuthChallenge from '@/components/buyer/AuthChallenge'
import{createClient}from'@/lib/supabase/client'
export default function AdminSecurity({email,configured,managePin=false}:{email:string;configured:boolean;managePin?:boolean}){
 const[pinConfigured,setPinConfigured]=useState(configured),[captchaToken,setCaptchaToken]=useState(''),[captchaAttempt,setCaptchaAttempt]=useState(0)
 const captchaEnabled=!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
 const[password,setPassword]=useState(''),[pin,setPin]=useState(''),[confirm,setConfirm]=useState(''),[oldPin,setOldPin]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[passwordVerified,setPasswordVerified]=useState(false),[done,setDone]=useState(false)
 async function unlock(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('')
  try{const client=createClient(),login=await client.auth.signInWithPassword({email,password,options:{captchaToken}});setPassword('');if(login.error){setError('Your account password could not be verified. Check it and try again.');return}
   const unlocked=await client.rpc('cm_unlock_admin');if(unlocked.error){setError('Admin unlock could not be confirmed. Make sure the password-and-PIN migration has been applied.');return}
   const status=await client.rpc('cm_admin_pin_status');if(status.error){setError('Transaction PIN setup could not be checked. Make sure the latest migration has been applied.');return}
   setPinConfigured(status.data?.configured===true);setPasswordVerified(true)
   if(status.data?.configured===true&&!managePin){setDone(true);window.location.replace('/admin')}
  }catch{setError('Could not verify your password. Check your connection and try again.')}finally{setPassword('');setBusy(false);if(captchaEnabled){setCaptchaToken('');setCaptchaAttempt(n=>n+1)}}
 }
 async function save(e:FormEvent){e.preventDefault();if(busy)return;setError('');if(pin!==confirm){setError('The new PINs do not match.');return}setBusy(true)
  try{const result=await createClient().rpc('cm_set_admin_pin',{p_pin:pin,p_old_pin:pinConfigured?oldPin:null});if(result.error){setError('PIN setup could not be confirmed. Re-enter your account password if more than five minutes have passed.');return}if(result.data?.ok!==true){setError(result.data?.error??'PIN could not be saved.');return}setPin('');setConfirm('');setOldPin('');setDone(true);window.location.replace('/admin')
  }catch{setError('PIN setup could not be confirmed. Check your connection before retrying.')}finally{setPin('');setConfirm('');setOldPin('');setBusy(false)}
 }
 return <section className="buyer-panel buyer-stack"><p>Use your existing CampusMart password to unlock this browser session for eight hours. A separate six-digit transaction PIN is required for each financial decision. Five wrong PINs lock transactions for 30 minutes.</p>
 {error&&<p className="buyer-notice is-error" role="alert">{error}</p>}
 {done?<div className="buyer-stack"><p role="status">Verified. Opening the admin workspace...</p><a href="/admin" className="buyer-btn is-primary">Open admin workspace</a></div>:!passwordVerified?<form className="buyer-form" method="post" onSubmit={unlock}><p className="buyer-help">Signed in as {email}. This is the same password you use for CampusMart. Google-only accounts can use Forgot password to set one.</p><label>CampusMart password<input className="buyer-input" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>{captchaEnabled&&<AuthChallenge key={captchaAttempt} onToken={setCaptchaToken}/>}<button className="buyer-btn is-primary" disabled={busy||!password||captchaEnabled&&!captchaToken}>{busy?'Verifying...':pinConfigured&&managePin?'Verify password to change PIN':'Unlock admin workspace'}</button></form>:<form className="buyer-form" method="post" onSubmit={save}>
 <h2>{pinConfigured?'Change transaction PIN':'Set your transaction PIN'}</h2><p className="buyer-help">Choose six digits that are not a repeated or obvious sequence. We store a salted password hash, never the PIN itself. Forgotten PINs require identity-checked recovery by a project operator.</p>
 {pinConfigured&&<label>Current transaction PIN<input className="buyer-input" type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{6}" maxLength={6} value={oldPin} onChange={e=>setOldPin(e.target.value.replace(/[^0-9]/g,''))}/></label>}
 <label>New transaction PIN<input className="buyer-input" type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/[^0-9]/g,''))}/></label><label>Confirm transaction PIN<input className="buyer-input" type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{6}" maxLength={6} value={confirm} onChange={e=>setConfirm(e.target.value.replace(/[^0-9]/g,''))}/></label><button className="buyer-btn is-primary" disabled={busy||pin.length!==6||confirm.length!==6||pinConfigured&&oldPin.length!==6}>{busy?'Saving...':'Save PIN and open workspace'}</button>
 </form>}
 </section>
}
