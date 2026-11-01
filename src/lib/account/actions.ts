'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Result={ok:true}|{error:string}
async function client(){const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)throw new Error('Please sign in to manage your account.');return supabase}
function message(error:unknown){return typeof error==='object'&&error&&'code'in error&&error.code==='P0001'&&'message'in error&&typeof error.message==='string'?error.message:'Your request could not be saved. Check your connection and try again.'}
function refresh(){revalidatePath('/settings/account');revalidatePath('/admin/account-requests');revalidatePath('/products');revalidatePath('/')}

export async function setStoreClosed(closed:unknown):Promise<Result>{
  if(typeof closed!=='boolean')return {error:'Choose whether to close or reopen your store.'}
  try{const supabase=await client();const {error}=await supabase.rpc('cm_set_store_closed',{p_closed:closed});if(error)throw error;refresh();return {ok:true}}catch(error){return {error:message(error)}}
}
export async function requestAccountChange(input:unknown):Promise<Result>{
  const parsed=z.object({kind:z.enum(['delete_data','close_account','close_both']),note:z.string().trim().max(1000),confirmed:z.literal(true)}).safeParse(input)
  if(!parsed.success)return {error:'Choose an action and confirm that you understand the request.'}
  try{const supabase=await client();const {error}=await supabase.rpc('cm_request_account_change',{p_kind:parsed.data.kind,p_note:parsed.data.note||null});if(error)throw error;refresh();return {ok:true}}catch(error){return {error:message(error)}}
}
export async function cancelAccountChange(id:unknown):Promise<Result>{
  const parsed=z.uuid().safeParse(id);if(!parsed.success)return {error:'This request could not be found.'}
  try{const supabase=await client();const {error}=await supabase.rpc('cm_cancel_account_change',{p_id:parsed.data});if(error)throw error;refresh();return {ok:true}}catch(error){return {error:message(error)}}
}
export async function reviewAccountChange(input:unknown):Promise<Result>{
  const parsed=z.object({id:z.uuid(),action:z.enum(['in_review','decline','approve_closure']),note:z.string().trim().min(10).max(2000),confirmed:z.literal(true)}).safeParse(input)
  if(!parsed.success)return {error:'Confirm the action and write a review note of 10 to 2,000 characters.'}
  try{const supabase=await client();const {data:admin,error:gate}=await supabase.rpc('is_admin');if(gate||admin!==true)return {error:'Administrator access is required.'};const {error}=await supabase.rpc('cm_admin_review_account_change',{p_id:parsed.data.id,p_action:parsed.data.action,p_note:parsed.data.note});if(error)throw error;refresh();return {ok:true}}catch(error){return {error:message(error)}}
}
