'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
export default function AdminSecurity(){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[factor,setFactor]=useState(''),[qr,setQr]=useState(''),[secret,setSecret]=useState(''),[code,setCode]=useState('')
  async function start(){
    if(busy)return;setBusy(true);setError('')
    try{
      const client=createClient(),listed=await client.auth.mfa.listFactors()
      if(listed.error)throw listed.error
      const verified=listed.data.totp.find(f=>f.status==='verified')
      if(verified){setFactor(verified.id);return}
      // Remove only unfinished TOTP enrolments. Verified factors are never removed.
      for(const pending of listed.data.all.filter(f=>f.factor_type==='totp'&&f.status==='unverified')){
        const removed=await client.auth.mfa.unenroll({factorId:pending.id});if(removed.error)throw removed.error
      }
      const enrolled=await client.auth.mfa.enroll({factorType:'totp',issuer:'CampusMart',friendlyName:'CampusMart administrator'})
      if(enrolled.error)throw enrolled.error
      setFactor(enrolled.data.id);setQr(enrolled.data.totp.qr_code);setSecret(enrolled.data.totp.secret)
    }catch{setError('Could not prepare the authenticator. Check your connection and that TOTP MFA is enabled in Supabase Auth.')}finally{setBusy(false)}
  }
  async function verify(e:React.FormEvent){
    e.preventDefault();if(busy||!factor)return;setBusy(true);setError('')
    try{
      const client=createClient(),result=await client.auth.mfa.challengeAndVerify({factorId:factor,code})
      if(result.error)throw result.error
      const allowed=await client.rpc('is_admin')
      if(allowed.error||allowed.data!==true)throw new Error('Verification not accepted')
      setQr('');setSecret('');setCode('');router.replace('/admin');router.refresh()
    }catch{setError('Verification failed. Enter the current six-digit code and check your device clock.');setCode('')}finally{setBusy(false)}
  }
  return <section className="buyer-panel buyer-stack">
    <p>Administrator access requires an authenticator code every 15 minutes. If you lose your authenticator, an authorised project operator must verify your identity and reset the factor through Supabase. There is no email or password-only bypass.</p>
    {!factor?<button className="buyer-btn is-primary" disabled={busy} onClick={()=>void start()}>{busy?'Preparing...':'Set up or unlock authenticator'}</button>:<>
      {qr&&<><p>Scan this code with your authenticator app, then enter its current code. Keep the setup key private and store a recovery copy securely.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr.startsWith('data:image/')?qr:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr)} alt="Private authenticator setup QR code" width={220} height={220}/>
      <details><summary>Enter the setup key manually</summary><code style={{overflowWrap:'anywhere'}}>{secret}</code></details></>}
      <form className="buyer-form" onSubmit={verify}><label>Authenticator code<input className="buyer-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))}/></label><button className="buyer-btn is-primary" disabled={busy||code.length!==6}>{busy?'Verifying...':'Verify and open workspace'}</button></form>
    </>}
    {error&&<p role="alert" className="buyer-notice is-error">{error}</p>}
  </section>
}
