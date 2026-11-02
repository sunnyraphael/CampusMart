import { timingSafeEqual } from 'node:crypto'
import { reconcilePayments } from '@/lib/paystack'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET,provided=request.headers.get('authorization')??''
  const expected=`Bearer ${secret??''}`
  if(!secret||secret.length<32||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return new Response('Unauthorized',{status:401})
  try{return Response.json(await reconcilePayments(),{headers:{'Cache-Control':'no-store'}})}catch{return new Response('Reconciliation unavailable',{status:503})}
}
