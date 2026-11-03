import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {timingSafeEqual} from 'node:crypto'
import {ownedProductImagePath} from '@/lib/vendor/images'
export function cronAuthorized(request:Request){const secret=process.env.CRON_SECRET,actual=request.headers.get('authorization')??'',expected=`Bearer ${secret??''}`;return !!secret&&secret.length>=32&&Buffer.byteLength(actual)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(actual),Buffer.from(expected))}
export function operationsService(deadline=Date.now()+55000){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key)throw new Error('Operations configuration is incomplete.')
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(Math.max(1,Math.min(5000,deadline-Date.now())))])})}})
}
export async function maintenanceRun(){
  const deadline=Date.now()+55000,service=operationsService(deadline),origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
  const queued=await service.rpc('cm_queue_orphan_images',{p_origin:origin})
  if(queued.error)throw new Error('Orphan inventory unavailable.')
  const claims=await service.rpc('cm_claim_operations_cleanup')
  if(claims.error)throw new Error('Cleanup queue unavailable.')
  let deleted=0,failed=0
  for(const job of claims.data??[]){
    if(Date.now()>deadline-15000)break // Other claims expire and remain retryable.
    const path=ownedProductImagePath(job.image_url,origin,job.vendor_id)
    let success=false
    if(path)try{
      const referenced=await service.rpc('cm_image_referenced',{p_name:path})
      if(referenced.error||referenced.data!==false)throw new Error('Reference check failed')
      const removed=await service.storage.from('product-images').remove([path])
      if(removed.error)throw new Error('Removal failed')
      const exists=await service.storage.from('product-images').exists(path)
      const absent=exists.error&&'status'in exists.error&&Number(exists.error.status)===404
      success=!exists.data&&(!exists.error||!!absent)
    }catch{/* Retain the durable job. Never remove private KYC files here. */}
    const finished=await service.rpc('cm_finish_operations_cleanup',{p_id:job.id,p_token:job.lease_token,p_success:success})
    if(success&&!finished.error)deleted++;else failed++
  }
  const sample=await service.rpc('cm_operations_sample')
  if(sample.error)throw new Error('Capacity sampling unavailable.')
  return {queued:Number(queued.data??0),deleted,failed,criticalAlerts:Number(sample.data?.critical_alerts??0)}
}
