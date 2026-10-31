'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { uuid } from '@/lib/buyer/validation'
import { ownedProductImagePath } from './images'

async function session() {
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error||!user)throw new Error('Please sign in to continue.')
  return {supabase,user}
}

export async function enrollVendor():Promise<{ok:true}|{error:string}> {
  try {
    const {supabase}=await session()
    const {error}=await supabase.rpc('cm_enroll_vendor')
    if(error)throw error
    revalidatePath('/','layout')
    return {ok:true}
  } catch(error) {console.error('Vendor enrollment failed',error);return {error:'Your vendor setup could not start. Please try again or contact support.'}}
}

export async function cleanupListingImages():Promise<{pending:boolean}> {
  try {
    const {supabase}=await session()
    const {data,error}=await supabase.rpc('cm_claim_listing_image_cleanup')
    if(error)throw error
    let pending=(data?.length??0)>=20
    for(const image of (data??[]) as {id:string;image_url:string;vendor_id:string;lease_token:string}[]) {
      const path=ownedProductImagePath(image.image_url,process.env.NEXT_PUBLIC_SUPABASE_URL??'',image.vendor_id)
      let result='ignored'
      if(path) {
        try {
          const removed=await supabase.storage.from('product-images').remove([path])
          result=removed.error?'pending':'deleted'
          if(removed.error)console.error('Image removal failed',removed.error)
          // An empty removal result can mean an already deleted file. Verify
          // absence before retiring the queue entry rather than assuming success.
          else if(!removed.data?.length) {
            const exists=await supabase.storage.from('product-images').exists(path)
            const missing=!exists.data&&exists.error&&'status' in exists.error&&exists.error.status===404
            result=!exists.data&&(!exists.error||missing)?'deleted':'pending'
          }
        }
        catch(error) {console.error('Image removal failed',error);result='pending'}
      }
      const finished=await supabase.rpc('cm_finish_listing_image_cleanup',{p_id:image.id,p_token:image.lease_token,p_result:result})
      if(finished.error||result==='pending')pending=true
    }
    return {pending}
  } catch(error) {console.error('Listing image cleanup failed',error);return {pending:true}}
}

export async function deleteListing(id:string):Promise<{ok:true;cleanupPending:boolean}|{error:string}> {
  if(!uuid.safeParse(id).success)return {error:'This listing could not be found.'}
  try {
    const {supabase}=await session()
    const {error}=await supabase.rpc('cm_delete_listing',{p_id:id})
    if(error)throw error
    const cleanup=await cleanupListingImages()
    revalidatePath('/vendor/listings');revalidatePath('/products');revalidatePath('/')
    return {ok:true,cleanupPending:cleanup.pending}
  } catch(error) {console.error('Listing deletion failed',error);return {error:'We could not delete this listing. If it has orders, unpublish it from the edit page instead.'}}
}
