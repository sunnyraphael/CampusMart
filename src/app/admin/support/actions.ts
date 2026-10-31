'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export async function replySupport(input:unknown):Promise<{error:string}|{ok:true}> {
  const values=z.object({id:z.uuid(),status:z.enum(['open','in_review','resolved']),reply:z.string().trim().min(1).max(4000)}).safeParse(input)
  if(!values.success)return {error:'Write a response of up to 4,000 characters.'}
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  const {data:isAdmin,error:adminError}=await supabase.rpc('is_admin')
  if(!user||adminError||isAdmin!==true)return {error:'Administrator access is required.'}
  const {data,error}=await supabase.from('support_requests').update({status:values.data.status,admin_reply:values.data.reply}).eq('id',values.data.id).select('id')
  if(error||!data?.length)return {error:'Could not update this request. Please try again.'}
  revalidatePath('/admin/support');revalidatePath('/contact')
  return {ok:true}
}
