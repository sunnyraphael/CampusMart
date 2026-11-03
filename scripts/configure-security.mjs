// Operator-run setup only; no customer data is read or modified.
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
try{
  if(!origin||!key)throw new Error('configuration')
  const parsed=new URL(origin)
  if(parsed.protocol!=='https:'||parsed.pathname!=='/'||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error('origin')
  const response=await fetch(parsed.origin+'/rest/v1/rpc/cm_configure_storage_origin',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_origin:parsed.origin}),signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw new Error('setup')
  console.log('Storage ownership origin configured successfully.')
}catch{console.error('Security setup could not be confirmed. Apply the security-hardening migration and check the local Supabase URL and service-role key. No secret values were printed.');process.exitCode=1}
