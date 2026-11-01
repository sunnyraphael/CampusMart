import Link from 'next/link'
import { BuyerPage } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import { safeRedirect } from '@/lib/buyer/validation'
import type { ConsentStatus } from '@/lib/privacy/consent'
import { redirect } from 'next/navigation'
import ConsentForm from './ConsentForm'

export default async function ConsentPage({searchParams}:{searchParams:Promise<{next?:string;vendor?:string}>}) {
  const {supabase}=await buyerSession('/consent')
  const params=await searchParams
  const {data,error}=await supabase.rpc('cm_consent_status')
  const status=data as ConsentStatus|null
  const next=safeRedirect(params.next)
  if(!error&&params.next&&next!=='/consent'&&!next.startsWith('/consent?')&&status?.eligible&&(params.vendor!=='1'||status.vendor_terms))redirect(next)
  return <BuyerPage title="Account permissions" description="Choose an age band, review the terms and keep control of your account. We do not need your date of birth.">
    {error?<div className="buyer-notice is-error" role="alert">Account permissions are temporarily unavailable. Please try again or <Link href="/contact">contact support</Link>.</div>:<ConsentForm status={data as ConsentStatus|null} next={safeRedirect(params.next)==='/consent'?'/profile':safeRedirect(params.next)} vendor={params.vendor==='1'}/>}
  </BuyerPage>
}
