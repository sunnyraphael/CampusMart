'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { enrollVendor } from '@/lib/vendor/actions'
import { useBuyerAccount } from '@/components/buyer/BuyerAccount'

export default function EnrollButton() {
  const [accepted,setAccepted]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const router=useRouter()
  const {refresh}=useBuyerAccount()
  async function enroll() {
    setBusy(true);setError('')
    try {const result=await enrollVendor(accepted);if('error'in result)setError(result.error);else {refresh();router.replace('/vendor/onboarding');router.refresh()}}
    catch {setError('Could not start your store setup. Please try again.')}
    finally {setBusy(false)}
  }
  return <div className="buyer-stack"><label className="by-check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I am 18 or older, or have reviewed guardian permission for selling, and agree to the <Link href="/vendor-terms">vendor terms</Link>, the 5% sales commission and the <Link href="/refunds">refund policy</Link>.</span></label>{error&&<p className="buyer-notice is-error" role="alert">{error}</p>}<div><button className="buyer-btn is-primary" disabled={busy||!accepted} onClick={enroll}>{busy?'Starting setup…':'Continue to store setup'}</button></div></div>
}
