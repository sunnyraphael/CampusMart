import 'server-only'
export async function publicCategories(){
  try{
    const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if(!origin||!key)throw new Error('Configuration unavailable')
    // Anonymous public data only. Never cache a cookie-bearing database client.
    const response=await fetch(`${origin}/rest/v1/categories?select=id,name,slug&order=name.asc`,{headers:{apikey:key,Authorization:`Bearer ${key}`},...(process.env.CAMPUSMART_E2E==='1'?{cache:'no-store' as const}:{next:{revalidate:300,tags:['public-categories']}}),signal:AbortSignal.timeout(8000)})
    if(!response.ok)throw new Error('Categories unavailable')
    const rows=await response.json()
    if(!Array.isArray(rows))throw new Error('Invalid category response')
    return {data:rows as {id:string;name:string;slug:string}[],error:null}
  }catch{return {data:null,error:'Categories could not load.'}}
}
