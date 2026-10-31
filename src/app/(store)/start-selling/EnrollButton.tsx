'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { enrollVendor } from '@/lib/vendor/actions'
import { useBuyerAccount } from '@/components/buyer/BuyerAccount'

export default function EnrollButton() {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const router=useRouter()
  const {refresh}=useBuyerAccount()
  async function enroll() {
    setBusy(true);setError('')
    try {const result=await enrollVendor();if('error'in result)setError(result.error);else {refresh();router.replace('/vendor/onboarding');router.refresh()}}
    catch {setError('Could not start your store setup. Please try again.')}
    finally {setBusy(false)}
  }
  return <div className="buyer-stack">{error&&<p className="buyer-notice is-error" role="alert">{error}</p>}<div><button className="buyer-btn is-primary" disabled={busy} onClick={enroll}>{busy?'Starting setup…':'Continue to store setup'}</button></div></div>
}
