'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {preferenceSaved,savePreference} from '@/lib/buyer/interface-preferences'
export default function CheckoutIntro({buyerId}:{buyerId:string}){
  const key=`campusmart-checkout-intro-v1:${buyerId}`
  const [show]=useState(()=>!preferenceSaved(key))
  useEffect(()=>{if(show)savePreference(key)},[key,show])
  if(!show)return null
  return <aside className="buyer-notice checkout-intro" aria-label="First checkout introduction"><p>Review your total and delivery details before paying.</p><details><summary>Read more</summary><div className="buyer-stack"><p>The summary shows item, service and delivery charges. Pickup needs no home address; your order contact details are shared for fulfilment.</p><p>Eligible voluntary cancellation is available within 30 minutes, before dispatch or pickup readiness. The disclosed CampusMart service fee is retained. Late delivery and disputes are reviewed separately, with full-refund remedies preserved.</p><p>Paystack handles payment details. A pending result should be checked from My orders before paying again.</p><div className="buyer-actions"><Link href="/terms#fees">Fees & terms</Link><Link href="/refunds">Refund policy</Link><Link href="/privacy">Privacy details</Link></div></div></details></aside>
}
