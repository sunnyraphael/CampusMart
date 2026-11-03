import {createClient} from '@supabase/supabase-js'
export const dynamic='force-dynamic'
export async function GET(){
  try{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if(!url||!key)throw new Error('Not configured')
    const client=createClient(url,key,{auth:{persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(5000)})}})
    const result=await client.rpc('cm_health_ping');if(result.error||result.data!==true)throw new Error('Unavailable')
    return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}})
  }catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
