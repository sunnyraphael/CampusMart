'use server'
import {z} from 'zod'
import {revalidatePath} from 'next/cache'
import {adminSession} from '@/lib/admin/server'
import {maintenanceRun,operationsService} from '@/lib/operations/server'
export async function sampleCapacity(){try{await adminSession();const r=await operationsService().rpc('cm_operations_sample');if(r.error)throw r.error;revalidatePath('/admin/operations');return {ok:true}}catch{return {error:'Capacity checks could not complete. Verify the migration and database connection.'}}}
export async function runPhotoMaintenance(){try{await adminSession();const r=await maintenanceRun();revalidatePath('/admin/operations');return {ok:true,summary:`Removed ${r.deleted} unused files; ${r.failed} need another attempt.`}}catch{return {error:'Cleanup did not finish. Durable jobs remain queued; retry later.'}}}
export async function saveOperations(input:unknown){
  const parsed=z.object({maintenance:z.boolean(),database_limit:z.number().int().min(1000000).max(1e14),storage_limit:z.number().int().min(1000000).max(1e14),egress_limit:z.number().int().min(1000000).max(1e14),cached_egress_limit:z.number().int().min(1000000).max(1e14),egress_used:z.number().int().nonnegative().max(1e14).optional(),cached_egress_used:z.number().int().nonnegative().max(1e14).optional(),usage_as_of:z.iso.datetime().optional()}).safeParse(input)
  if(!parsed.success)return {error:'Check your limits and current billing-cycle usage.'}
  try{const {supabase}=await adminSession();const r=await supabase.rpc('cm_admin_operations',{p_settings:parsed.data});if(r.error)throw r.error;await operationsService().rpc('cm_operations_sample');revalidatePath('/admin/operations');revalidatePath('/checkout');return {ok:true}}catch{return {error:'Operations settings could not be confirmed. Refresh before retrying.'}}
}
