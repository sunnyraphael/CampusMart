'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

async function signedIn() {
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)throw new Error('Please sign in to continue.')
  return supabase
}
export async function acceptMarketplaceConsent(input:unknown):Promise<{ok:true}|{error:string}> {
  const checked=z.object({age_band:z.enum(['adult','under_18']),accepted:z.literal(true),guardian_request_id:z.union([z.uuid(),z.literal('')]),vendor:z.boolean()}).safeParse(input)
  if(!checked.success)return {error:'Choose your age band and accept the terms. A reviewed guardian reference is required for under-18 students.'}
  try {
    const supabase=await signedIn(),v=checked.data
    const result=await supabase.rpc('cm_accept_marketplace_terms',{p_age_band:v.age_band,p_accepted:true,p_guardian_request_id:v.age_band==='under_18'?v.guardian_request_id||null:null})
    if(result.error)return {error:result.error.code==='P0001'?result.error.message:'Account permissions could not be saved. Try again or contact support.'}
    if(v.vendor){const result=await supabase.rpc('cm_accept_vendor_terms',{p_accepted:true});if(result.error)return {error:'Your account terms were saved, but vendor terms could not be saved. Please retry.'}}
    revalidatePath('/','layout');return {ok:true}
  } catch {return {error:'Your permissions could not be saved. Please check your connection and retry.'}}
}
export async function requestGuardianPermission(input:unknown):Promise<{id:string}|{error:string}> {
  const checked=z.object({email:z.email().max(254),relationship:z.enum(['parent','legal_guardian']),accepted:z.literal(true),allows_selling:z.boolean()}).safeParse(input)
  if(!checked.success)return {error:'Enter the student sign-in email and confirm that you are their parent or legal guardian.'}
  try {
    const supabase=await signedIn(),v=checked.data
    if(v.allows_selling){const vendor=await supabase.rpc('cm_accept_vendor_terms',{p_accepted:true});if(vendor.error)return {error:'Your own account must accept the vendor terms before authorizing a student store.'}}
    const {data,error}=await supabase.rpc('cm_request_guardian_permission',{p_student_email:v.email.trim(),p_relationship:v.relationship,p_accepted:true,p_allow_selling:v.allows_selling})
    if(error||typeof data!=='string')return {error:error?.code==='P0001'?error.message:'The permission request could not be saved. Try again or contact support.'}
    revalidatePath('/guardian-permission');return {id:data}
  }catch{return {error:'The request could not be saved. Your draft is still here.'}}
}
export async function withdrawGuardianPermission(id:string):Promise<{ok:true}|{error:string}> {
  if(!z.uuid().safeParse(id).success)return {error:'This request could not be found.'}
  try {
    const supabase=await signedIn();const {error}=await supabase.rpc('cm_withdraw_guardian_permission',{p_id:id})
    if(error)return {error:'Permission could not be withdrawn. Refresh and try again.'}
    revalidatePath('/guardian-permission');return {ok:true}
  }catch{return {error:'Permission could not be withdrawn. Please retry.'}}
}
