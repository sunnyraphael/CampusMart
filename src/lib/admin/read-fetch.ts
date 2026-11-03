// Apply deadlines only to reads. Financial mutations keep their existing result handling.
const reads=new Set(['is_admin','cm_admin_membership','cm_admin_delivery_queue','admin_kyc_queue','cm_admin_order_disputes','cm_admin_operations','cm_admin_guardian_queue','cm_admin_account_requests','cm_store_overview','cm_admin_store_items'])
export const adminReadFetch:typeof fetch=(input,init)=>{
 const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase()
 const path=new URL(input instanceof Request?input.url:String(input)).pathname
 if(path.endsWith('/cm_admin_operations')&&typeof init?.body==='string'){try{if('p_settings' in JSON.parse(init.body))return fetch(input,init)}catch{return fetch(input,init)}}
 if(method!=='GET'&&!reads.has(path.split('/').at(-1)??''))return fetch(input,init)
 const signals=[AbortSignal.timeout(10000),...(init?.signal?[init.signal]:[])]
 return fetch(input,{...init,signal:AbortSignal.any(signals)})
}
