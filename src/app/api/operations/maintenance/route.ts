import {cronAuthorized,maintenanceRun} from '@/lib/operations/server'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(request:Request){
  if(!cronAuthorized(request))return new Response('Unauthorized',{status:401})
  try{const result=await maintenanceRun();return Response.json(result,{status:result.failed||result.criticalAlerts?503:200,headers:{'Cache-Control':'no-store'}})}catch{return new Response('Maintenance needs administrator review',{status:503})}
}
