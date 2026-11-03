'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { paymentService } from '@/lib/paystack/config'
import {publicImageSiblings} from '@/lib/media/paths'
import { ownedProductImagePath } from './images'

async function access(id:string){
  if(!z.uuid().safeParse(id).success)throw new Error('Invalid store.')
  const supabase=await createClient(),auth=await supabase.auth.getUser()
  if(!auth.data.user)throw new Error('Sign in first.')
  const seller=await supabase.from('sellers').select('id,user_id,store_closed_at').eq('id',id).single()
  if(seller.error||!seller.data)throw new Error('Store unavailable.')
  const admin=await supabase.rpc('is_admin')
  if(seller.data.user_id!==auth.data.user.id&&(admin.error||admin.data!==true))throw new Error('Store unavailable.')
  return {supabase,seller:seller.data}
}
async function cleanup(id:string,discover:boolean){
  const service=paymentService(),origin=process.env.NEXT_PUBLIC_SUPABASE_URL??''
  // Discover orphaned uploads too, exclusively inside this store's public folder.
  if(discover){
    let scanned=0
    async function folder(prefix:string,depth:number):Promise<void>{
      if(depth>4)throw new Error('Image folders need administrator review.')
      for(let offset=0;;offset+=100){
        const files=await service.storage.from('product-images').list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}})
        if(files.error)throw new Error('Image inventory unavailable. Retry cleanup.')
        for(const file of files.data??[]){
          if(++scanned>5000)throw new Error('Large image inventory needs administrator review.')
          if(!file.name||file.name.includes('/')||file.name==='..'||file.name==='.')continue
          const path=`${prefix}/${file.name}`
          if(!file.id){await folder(path,depth+1);continue}
          const image_url=service.storage.from('product-images').getPublicUrl(path).data.publicUrl
          const queued=await service.from('listing_image_cleanup').upsert({vendor_id:id,image_url},{onConflict:'image_url',ignoreDuplicates:true})
          if(queued.error)throw new Error('Image cleanup could not be queued.')
        }
        if((files.data?.length??0)<100)break
      }
    }
    await folder(id,0)
  }
  const jobs=await service.from('listing_image_cleanup').select('id,image_url').eq('vendor_id',id).in('status',['pending','deleting']).limit(100)
  if(jobs.error)throw new Error('Image cleanup unavailable.')
  for(const job of jobs.data??[]){
    const path=ownedProductImagePath(job.image_url,origin,id)
    if(!path)continue
    const [products,logos]=await Promise.all([service.from('products').select('id',{count:'exact',head:true}).overlaps('images',publicImageSiblings(job.image_url)),service.from('sellers').select('id',{count:'exact',head:true}).in('logo_url',publicImageSiblings(job.image_url))])
    if(products.error||logos.error||products.count||logos.count)continue
    const removed=await service.storage.from('product-images').remove([path])
    if(removed.error)continue
    const exists=await service.storage.from('product-images').exists(path)
    const missing=exists.error&&'status'in exists.error&&Number(exists.error.status)===404
    if(exists.data||exists.error&&!missing)continue
    await service.from('listing_image_cleanup').update({status:'deleted',lease_token:null,leased_at:null}).eq('id',job.id)
  }
  const remaining=await service.from('listing_image_cleanup').select('id',{count:'exact',head:true}).eq('vendor_id',id).in('status',['pending','deleting'])
  if(remaining.error)throw new Error('Cleanup result unavailable. Check again.')
  return remaining.count??0
}
export async function manageStore(input:unknown){
  const parsed=z.object({sellerId:z.uuid(),admin:z.boolean().default(false),confirmation:z.string().default(''),action:z.enum(['pause','resume','close','reopen','purge_images','retry_cleanup']),note:z.string().trim().min(5).max(1000)}).safeParse(input)
  if(!parsed.success)return {error:'Choose an action and enter a reason of at least five characters.'}
  try{
    const v=parsed.data
    if(v.action==='purge_images'&&v.confirmation!=='DELETE PHOTOS')return {error:'Type DELETE PHOTOS to confirm permanent removal.'}
    const {supabase,seller}=await access(v.sellerId)
    if(v.action!=='retry_cleanup'){
      const result=await supabase.rpc('cm_manage_store',{p_seller:v.sellerId,p_action:v.action,p_note:v.note,p_as_admin:v.admin})
      if(result.error)return {error:result.error.code==='P0001'?result.error.message:'Store action could not be confirmed. Refresh before retrying.'}
    }else if(!seller.store_closed_at)return {error:'Close the store before running permanent photo cleanup.'}
    let pending=0
    if(v.action==='purge_images'||v.action==='retry_cleanup')pending=await cleanup(v.sellerId,true)
    for(const path of ['/','/products','/categories','/deals','/vendor/settings','/vendor/listings','/admin/stores',`/admin/stores/${v.sellerId}`,`/vendors/${v.sellerId}`])revalidatePath(path)
    return {ok:true as const,pending}
  }catch{return {error:'The result could not be confirmed. Refresh the store; if photos remain queued, use Retry photo cleanup.'}}
}
export async function messageStore(id:string){
  try{const {supabase}=await access(id);const result=await supabase.rpc('cm_start_conversation',{p_vendor_id:id,p_product_id:null});if(result.error||typeof result.data!=='string')return {error:'Conversation unavailable. You cannot message your own store.'};return {id:result.data}}catch{return {error:'Conversation unavailable.'}}
}
