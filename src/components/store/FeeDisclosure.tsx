import Link from 'next/link'
import { ReceiptText } from 'lucide-react'
import { SERVICE_FEE_RATE, SERVICE_FEE_WAIVED_FROM } from '@/lib/fees'
import { formatPrice } from '@/lib/utils/format'

export default function FeeDisclosure({compact=false}:{compact?:boolean}) {
  return <div className={`sh-fee-note${compact?' is-compact':''}`}><ReceiptText size={16} aria-hidden/><p>Item prices exclude checkout charges. Service fee: {SERVICE_FEE_RATE*100}% below {formatPrice(SERVICE_FEE_WAIVED_FROM)}, waived from {formatPrice(SERVICE_FEE_WAIVED_FROM)}. Any delivery charge is shown before you place an order. <Link href="/terms#fees">Fee details</Link></p></div>
}
