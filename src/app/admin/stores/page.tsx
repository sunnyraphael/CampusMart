import Link from 'next/link'
import {adminSession} from '@/lib/admin/server'
import {paymentService} from '@/lib/paystack/config'
import {AdminHeading} from '@/components/admin/Workspace'
export default async function StoresPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
  await adminSession()
  const params=await searchParams
  const q=typeof params.q==='string'?params.q.trim().slice(0,80):'',page=Math.max(1,Math.min(100000,Number.parseInt(params.page??'1')||1)),offset=(page-1)*20
  let query=paymentService().from('sellers').select('id,store_name,logo_url,campus,store_closed_at,owner_paused,admin_paused,admin_closed',{count:'exact'}).order('store_name').order('id').range(offset,offset+19)
  if(q)query=query.ilike('store_name','%'+q.replace(/[\\%_]/g,'\\$&')+'%')
  const stores=await query
  const failed=stores.error
  return <section className="buyer-stack"><AdminHeading eyebrow="Marketplace management" title="Vendor stores" description="Review store owners, trading activity, payout beneficiaries and store availability."/><form className="buyer-panel buyer-actions"><label>Search store name<input name="q" className="buyer-input" defaultValue={q} maxLength={80}/></label><button className="buyer-btn">Search</button></form>{failed?<p role="alert" className="buyer-notice is-error">Stores could not load. Apply the store-management migration and refresh.</p>:<><p className="buyer-help">{stores.count??0} stores · Page {page}. Open a store to review its owner, activity and controls.</p><div className="store-directory store-directory-compact">{stores.data?.map(s=>{return <Link className="buyer-panel store-directory-card" href={`/admin/stores/${s.id}`} key={s.id}><div className="buyer-row">{s.logo_url?<img referrerPolicy="no-referrer" className="store-directory-logo" src={s.logo_url} alt=""/>:<span className="store-directory-logo">{s.store_name?.slice(0,2).toUpperCase()}</span>}<div><h2>{s.store_name}</h2><p className="buyer-help">{s.campus??'Campus not provided'}</p></div></div><span className="buyer-status">{s.store_closed_at?'Closed':s.owner_paused||s.admin_paused?'Paused':'Open'}</span><span className="store-directory-open" aria-hidden="true">View store &rarr;</span></Link>})}</div>{!stores.data?.length&&<p className="buyer-notice">No stores found.</p>}<nav className="buyer-actions" aria-label="Store pages">{page>1&&<Link className="buyer-btn" href={`/admin/stores?q=${encodeURIComponent(q)}&page=${page-1}`}>Previous</Link>}{offset+20<(stores.count??0)&&<Link className="buyer-btn" href={`/admin/stores?q=${encodeURIComponent(q)}&page=${page+1}`}>Next</Link>}</nav></>}</section>
}
