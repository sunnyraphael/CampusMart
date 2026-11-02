import {paymentConfig,paymentsEnabled} from '@/lib/paystack/config'
import { CheckoutSkeleton } from '@/components/loading/StoreSkeletons'
import { trialCheckoutEnabled } from '@/lib/orders/trial'
export default function Loading() { return <CheckoutSkeleton trial={trialCheckoutEnabled(process.env)} paystackMode={paymentsEnabled()?paymentConfig().mode:null} /> }
