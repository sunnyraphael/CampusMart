'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { adminSession } from '@/lib/admin/server'
import { paymentConfig,paymentService,paystackBanks } from './config'
import { processRefund,reconcilePayments } from './index'
import { processTransfer } from './transfers'
function fail(error:unknown){return {error:typeof error==='object'&&error!==null&&'code'in error&&error.code==='P0001'&&'message'in error&&typeof error.message==='string'?error.message:'The provider operation could not be confirmed. Check the recorded status before retrying.'}}
export async function savePayoutAccount(input:unknown){
  const parsed=z.object({bank:z.string().regex(/^\d{3,10}$/),account:z.string().regex(/^\d{10}$/),confirmed:z.literal(true)}).safeParse(input)
  if(!parsed.success)return {error:'Select a bank, enter a 10-digit account number and confirm the payout-account declaration.'}
  try{
    const supabase=await createClient(),auth=await supabase.auth.getUser(),user=auth.data.user
    if(!user||!user.last_sign_in_at||Date.now()-new Date(user.last_sign_in_at).getTime()>10*60000)return {error:'Sign out and sign in again before changing payout details (recent sign-in required).'}
    const permission=await supabase.rpc('cm_consent_status')
    if(permission.error||permission.data?.age_band!=='adult'||permission.data?.selling_eligible!==true)return {error:'Payouts require an eligible adult vendor account.'}
    const seller=await supabase.from('sellers').select('id').eq('user_id',user.id).single()
    if(seller.error||!seller.data)return {error:'Your vendor store is unavailable.'}
    const config=paymentConfig(),v=parsed.data
    const attempt=await paymentService().rpc('cm_begin_payout_setup',{p_user_id:user.id,p_mode:config.mode})
    if(attempt.error)throw attempt.error
    const resolved=await config.api<{account_number:string;account_name:string}>('/bank/resolve?account_number='+v.account+'&bank_code='+v.bank)
    if(resolved.account_number!==v.account||!resolved.account_name)throw new Error('Account resolution mismatch')
    const banks=await paystackBanks()
    const bank=banks.find(bank=>bank.code===v.bank);if(!bank)throw new Error('Bank unavailable')
    const recipient=await config.api<{recipient_code:string;active:boolean}>('/transferrecipient',{type:'nuban',name:resolved.account_name,account_number:v.account,bank_code:v.bank,currency:'NGN'})
    if(!recipient.active||!/^RCP_[a-zA-Z0-9]+$/.test(recipient.recipient_code))throw new Error('Recipient unavailable')
    const saved=await paymentService().from('paystack_recipients').upsert({seller_id:seller.data.id,mode:config.mode,recipient_code:recipient.recipient_code,account_name:resolved.account_name,bank_name:bank.name,last_four:v.account.slice(-4),updated_at:new Date().toISOString()},{onConflict:'seller_id,mode'})
    if(saved.error)throw new Error('Payout account could not be saved')
    revalidatePath('/vendor/payout-account');revalidatePath('/admin/payments')
    return {ok:true as const,accountName:resolved.account_name}
  }catch(error){return fail(error)}
}
export async function reconcileFinanceJob(input:unknown){
  const parsed=z.object({id:z.uuid(),kind:z.enum(['refund','transfer'])}).safeParse(input)
  if(!parsed.success)return {error:'Choose a recorded finance job.'}
  try{await adminSession();if(parsed.data.kind==='refund')await processRefund(parsed.data.id);else await processTransfer(parsed.data.id);revalidatePath('/admin/payments');return {ok:true as const}}catch(error){return fail(error)}
}
export async function refreshPaymentQueue(){try{await adminSession();await reconcilePayments();revalidatePath('/admin/payments');return {ok:true as const}}catch(error){return fail(error)}}
