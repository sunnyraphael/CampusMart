'use client'
import Link from 'next/link'
import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, FileClock } from 'lucide-react'
import { AdminHeading, QueueSummary, QueueToolbar } from '@/components/admin/Workspace'
import AdminRefresh from '@/components/admin/RefreshButton'
import { queueMatches } from '@/lib/admin/queues'
import { reviewAccountChange } from '@/lib/account/actions'
import { accountRequestLabels, type AccountRequest } from '@/lib/account/types'
export type AdminAccountRequest=AccountRequest&{user_id:string;full_name:string|null;email:string|null;store_name:string|null;store_closed_at:string|null;events:{id:string;status:string;note:string|null;created_at:string}[]}
export default function AccountRequestsClient({items,closed,loadError}:{items:AdminAccountRequest[];closed:boolean;loadError:boolean}){
  const [query,setQuery]=useState('')
  const [kind,setKind]=useState('all')
  const shown=items.filter(item=>queueMatches(query,item.id,item.full_name,item.email,item.store_name,item.note)&&(kind==='all'||item.kind===kind))
  return <section>
    <AdminHeading title="Privacy and account requests" description="Review privacy requests, settle obligations and record account closure decisions." actions={<AdminRefresh/>}/>
    <QueueSummary items={[{label:'Requests in this view',value:items.length},{label:'Data removal',value:items.filter(item=>item.kind==='delete_data').length},{label:'Account closures',value:items.filter(item=>item.kind!=='delete_data').length}]}/>
    <nav className="buyer-actions ar-views" aria-label="Account request views"><Link className="buyer-btn" href="/admin/account-requests" aria-current={!closed?'page':undefined}>Open requests</Link><Link className="buyer-btn" href="/admin/account-requests?view=closed" aria-current={closed?'page':undefined}>Past requests</Link></nav>
    <QueueToolbar query={query} onQuery={setQuery} placeholder="Search account requests" count={`${shown.length} of ${items.length} loaded`}><select aria-label="Request type" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All requests</option><option value="delete_data">Data removal</option><option value="close_account">Account only</option><option value="close_both">Account and store</option></select></QueueToolbar>
    <p className="buyer-notice"><ShieldCheck size={20} aria-hidden/>Approving closure deactivates account activity and closes the store. It preserves records. Data removal must be handled separately after reviewing retention requirements; these review buttons do not erase data.</p><p className="buyer-help">Showing up to 100 requests, oldest first. A zero wallet balance and settled orders are required before account closure can be approved.</p>
    {loadError?<p className="buyer-notice is-error" role="alert">Account requests could not load. Refresh to try again.</p>:!shown.length?<div className="dq-empty"><FileClock size={28} aria-hidden/><h2>{items.length?'No matching requests':'No account requests in this view'}</h2><p>{items.length?'Try another search or request type.':'New requests will appear here when submitted.'}</p></div>:shown.map(item=><RequestCard key={item.id} item={item}/>)}
  </section>
}
function RequestCard({item}:{item:AdminAccountRequest}){
  const router=useRouter()
  const [action,setAction]=useState<'in_review'|'decline'|'approve_closure'>('in_review')
  const [note,setNote]=useState('')
  const [confirmed,setConfirmed]=useState(false)
  const [busy,setBusy]=useState(false)
  const [refreshing,startTransition]=useTransition()
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const open=item.status==='pending'||item.status==='in_review'
  async function submit(e:FormEvent){
    e.preventDefault();if(busy||refreshing)return
    setBusy(true);setError('');setNotice('')
    try{const result=await reviewAccountChange({id:item.id,action,note,confirmed});if('error'in result){setError(result.error);return}setNotice(action==='approve_closure'?'Account closed. Retained records have not been erased.':'Review saved. The account owner can see your note.');setConfirmed(false);setNote('');startTransition(()=>router.refresh())}catch{setError('This review could not be saved. Please retry.')}finally{setBusy(false)}
  }
  return <article className="ar-card" id={`account-request-${item.id}`}><header><div><h2>{accountRequestLabels[item.kind]}</h2><p>{item.full_name||'Account owner'}{item.email&&` · ${item.email}`}</p></div><span className="aw-pill">{item.status.replace('_',' ')}</span></header><p className="buyer-help">Reference {item.id.slice(0,8).toUpperCase()} &middot; {new Date(item.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}{item.store_name&&` · Store: ${item.store_name} (${item.store_closed_at?'closed':'open'})`}</p>{item.note&&<div className="ar-request-note"><strong>Owner&apos;s request</strong><p>{item.note}</p></div>}{item.admin_note&&<p className="buyer-help">Latest review note: {item.admin_note}</p>}{!!item.events?.length&&<details className="ar-history"><summary>Review history</summary><ol>{item.events.map(event=><li key={event.id}><span><strong>{event.status.replace('_',' ')}</strong> · {new Date(event.created_at).toLocaleDateString('en-NG')}</span><p>{event.note}</p></li>)}</ol></details>}
    {open&&<form className="buyer-form" onSubmit={submit}><label>Review action<select className="buyer-input" value={action} onChange={e=>{setAction(e.target.value as typeof action);setConfirmed(false)}}><option value="in_review">Keep in review</option><option value="decline">Decline with explanation</option>{item.kind!=='delete_data'&&<option value="approve_closure">Approve account closure</option>}</select></label><label>Update for the account owner<textarea className="buyer-input" minLength={10} maxLength={2000} rows={3} value={note} onChange={e=>setNote(e.target.value)} required/></label><label className="ar-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/><span>{action==='approve_closure'?'I have checked outstanding orders, disputes and balances. This deactivates the account and preserves required records.':'I understand this records a review update and does not erase any personal data.'}</span></label><div><button className="buyer-btn is-primary" disabled={busy||refreshing||!confirmed}>{busy||refreshing?'Saving...':action==='approve_closure'?'Confirm account closure':'Save review'}</button></div></form>}{error&&<p className="buyer-notice is-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </article>
}
