import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { makePaystackClient, type PaymentMode } from './protocol'

export function paymentConfig(){
  const mode=process.env.PAYSTACK_MODE
  const key=process.env.PAYSTACK_SECRET_KEY
  if(!['test','live'].includes(mode??'')||!key?.startsWith(`sk_${mode}_`)||(mode==='live'&&process.env.PAYSTACK_LIVE_ENABLED!=='1'))throw new Error('Paystack is not configured for this payment environment.')
  const origin=new URL(process.env.NEXT_PUBLIC_APP_URL??'http://localhost:3000')
  if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||(mode==='live'&&origin.protocol!=='https:'))throw new Error('Configure the public HTTPS site URL before enabling live payments.')
  return {mode:mode as PaymentMode,key,origin:origin.origin,api:makePaystackClient(key)}
}
export function paymentsEnabled(){try{paymentConfig();return true}catch{return false}}
export function paymentService(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key)throw new Error('Payment database setup is incomplete.')
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
}
