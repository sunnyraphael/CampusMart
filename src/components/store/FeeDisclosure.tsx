'use client'
import Link from 'next/link'
import { ReceiptText,X } from 'lucide-react'
import {FEE_NOTICE_KEY,savePreference,useFeeNoticeDismissed} from '@/lib/buyer/interface-preferences'
import { SERVICE_FEE_RATE, SERVICE_FEE_WAIVED_FROM } from '@/lib/fees'
import { formatPrice } from '@/lib/utils/format'

export default function FeeDisclosure({compact=false,preview=false}:{compact?:boolean;preview?:boolean}) {
  const hidden=useFeeNoticeDismissed()
  if(hidden)return null
  return <div className={`sh-fee-note${compact?' is-compact':''}`}><ReceiptText size={16} aria-hidden/><p>Item prices exclude checkout charges. Service fee: {SERVICE_FEE_RATE*100}% below {formatPrice(SERVICE_FEE_WAIVED_FROM)}, waived from {formatPrice(SERVICE_FEE_WAIVED_FROM)}. Any delivery charge is shown before you place an order. {preview?<span>Fee details</span>:<Link href="/terms#fees">Fee details</Link>}</p>{preview?<span className="fee-notice-dismiss"><X size={17}/></span>:<button type="button" className="fee-notice-dismiss" aria-label="Dismiss fee notice everywhere" onClick={()=>savePreference(FEE_NOTICE_KEY)}><X size={17} aria-hidden/></button>}</div>
}
