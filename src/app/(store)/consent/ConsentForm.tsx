'use client'
import Link from 'next/link'
import { useState,type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { acceptMarketplaceConsent } from '@/lib/privacy/consent-actions'
import type { ConsentStatus } from '@/lib/privacy/consent'

export default function ConsentForm({status,next,vendor}:{status:ConsentStatus|null;next:string;vendor:boolean}) {
  const router=useRouter()
  const [band,setBand]=useState(status?.age_band??'')
  const [reference,setReference]=useState(status?.guardian_request_id??'')
  const [accepted,setAccepted]=useState(false)
  const [vendorAccepted,setVendorAccepted]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await acceptMarketplaceConsent({age_band:band,accepted,guardian_request_id:reference.trim(),vendor:vendor&&vendorAccepted});if('error'in result)setError(result.error);else{router.replace(next);router.refresh()}}catch{setError('The change could not be saved. Please retry.')}finally{setBusy(false)}}
  return <section className="buyer-panel buyer-stack"><h2>{status?.accepted?'Review your permissions':'Before you buy or sell'}</h2><p>Your age band is a declaration. Permission for an under-18 student must be reviewed before registration or marketplace use. Optional tracking is managed separately in cookie preferences.</p>
    <form className="buyer-form" onSubmit={submit}><label>Age band<select className="buyer-input" value={band} required disabled={!!status?.age_band} onChange={e=>setBand(e.target.value)}><option value="">Choose an age band</option><option value="adult">18 or older</option><option value="under_18">Under 18</option></select></label>
      {band==='under_18'&&<><div className="buyer-notice">Ask your parent or legal guardian to use <Link href="/guardian-permission">Guardian permission</Link> from their own adult account. CampusMart reviews their authority and permission before approving a reference.</div><label>Approved guardian permission reference<input className="buyer-input" required value={reference} onChange={e=>setReference(e.target.value)} placeholder="Reference shared by your guardian" autoComplete="off"/></label></>}
      <label className="by-check"><input type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I agree to the <Link href="/terms">buyer terms</Link> and acknowledge the <Link href="/privacy">privacy policy</Link>. This does not sign me up for marketing.</span></label>
      {vendor&&band==='under_18'&&!status?.selling_eligible&&<p className="buyer-notice">Your reviewed permission must explicitly include selling. Ask your guardian to request that access and wait for admin review. Buyer-only permission cannot open a store.</p>}
      {vendor&&<label className="by-check"><input type="checkbox" required checked={vendorAccepted} onChange={e=>setVendorAccepted(e.target.checked)}/><span>I also agree to the <Link href="/vendor-terms">vendor terms</Link>, including the limited-time 0% vendor commission launch offer and delivery review process.</span></label>}
      {error&&<p className="buyer-notice is-error" role="alert">{error}</p>}<div className="buyer-actions"><button className="buyer-btn is-primary" disabled={busy}>{busy?'Saving…':'Save and continue'}</button><Link className="buyer-btn" href="/">Keep browsing</Link></div>
    </form><p className="buyer-help">Need to correct your recorded age band or withdraw guardian permission? <Link href="/contact">Contact support</Link> or use the guardian&apos;s permission history. Existing order help remains available.</p>
  </section>
}
