import 'server-only'
import {headers} from 'next/headers'
import {createHmac} from 'node:crypto'
import {isIP} from 'node:net'
import {paymentService} from '@/lib/paystack/config'
export async function checkoutNetworkBudget(){
  // Configure only when a trusted ingress overwrites this header and the origin
  // cannot be reached directly. Untrusted forwarded headers are not identities.
  const header=process.env.CAMPUSMART_TRUSTED_IP_HEADER
  if(!header)return
  if(!['cf-connecting-ip','x-vercel-forwarded-for'].includes(header))throw new Error('Invalid trusted network header configuration.')
  const secret=process.env.CRON_SECRET
  if(!secret||secret.length<32)throw new Error('Security budget configuration is incomplete.')
  const address=(await headers()).get(header)?.trim()
  if(!address||!isIP(address))throw new Error('The trusted network identity is unavailable. Please contact support.')
  const key=createHmac('sha256',secret).update('checkout-network:'+address).digest('hex')
  const budget=await paymentService().rpc('cm_security_budget',{p_key:key,p_scope:'checkout_network'})
  if(budget.error)throw new Error('Too many checkout attempts or the security check is unavailable. Please wait and try again.')
}
