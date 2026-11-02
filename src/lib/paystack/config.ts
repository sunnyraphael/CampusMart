import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { makePaystackClient, type PaymentMode } from './protocol'

export function paymentConfig(){
  const mode=process.env.PAYSTACK_MODE
  const key=process.env.PAYSTACK_SECRET_KEY
  if(!['test','live'].includes(mode??'')||!key?.startsWith(`sk_${mode}_`)||(mode==='live'&&process.env.PAYSTACK_LIVE_ENABLED!=='1'))throw new Error('Paystack is not configured for this payment environment.')
  if(mode==='live'&&(!process.env.CRON_SECRET||process.env.CRON_SECRET.length<32))throw new Error('Configure reconciliation authentication before enabling live payments.')
  const origin=new URL(process.env.NEXT_PUBLIC_APP_URL??'http://localhost:3000')
  if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||(mode==='live'&&origin.protocol!=='https:'))throw new Error('Configure the public HTTPS site URL before enabling live payments.')
  // Only the isolated test runner with its literal dummy key can use this adapter.
  // A real test/live key always uses Paystack's fixed HTTPS API origin.
  const fixture=process.env.CAMPUSMART_E2E==='1'&&process.env.CAMPUSMART_PAYSTACK_FIXTURE==='1'&&key==='sk_test_fixture'
  const fetcher:typeof fetch=fixture?(input,init)=>fetch(String(input).replace('https://api.paystack.co','http://127.0.0.1:54329/__paystack'),init):fetch
  return {mode:mode as PaymentMode,key,origin:origin.origin,api:makePaystackClient(key,fetcher)}
}
export function paymentsEnabled(){try{paymentConfig();return true}catch{return false}}
export async function paystackBanks(){
  const {api}=paymentConfig(),banks:{code:string;name:string;active?:boolean;is_deleted?:boolean;type?:string}[]=[],seen=new Set<string>()
  let next:string|null=null
  for(let page=0;page<20;page++){
    const result:{data:typeof banks;meta?:{next?:string|null}}=await api.page<typeof banks>('/bank?country=nigeria&currency=NGN&type=nuban&perPage=100&use_cursor=true'+(next?'&next='+encodeURIComponent(next):''))
    banks.push(...result.data)
    next=result.meta?.next??null
    if(!next)return banks.filter(bank=>bank.active!==false&&!bank.is_deleted).sort((a,b)=>a.name.localeCompare(b.name))
    if(seen.has(next))throw new Error('Bank pagination could not be confirmed')
    seen.add(next)
  }
  throw new Error('Bank list is incomplete')
}
export function paymentService(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key)throw new Error('Payment database setup is incomplete.')
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
}
