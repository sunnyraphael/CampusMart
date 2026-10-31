'use client'
import { useState } from 'react'
import { LifeBuoy } from 'lucide-react'
import { AdminHeading, QueueSummary, QueueToolbar } from '@/components/admin/Workspace'
import AdminRefresh from '@/components/admin/RefreshButton'
import { queueMatches } from '@/lib/admin/queues'
import ReplyForm from './ReplyForm'

export type SupportRequest={id:string;subject:string;body:string;status:string;admin_reply:string|null;created_at:string;order_id:string|null}
export default function SupportClient({items,loadError}:{items:SupportRequest[];loadError:boolean}) {
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('all')
  const shown=items.filter(i=>queueMatches(query,i.id,i.subject,i.body,i.order_id)&&(status==='all'||i.status===status))
  return <section>
    <AdminHeading title="Support requests" description="Help buyers, keep responses in their support history and track each request to resolution." actions={<AdminRefresh/>}/>
    <QueueSummary items={['open','in_review','resolved'].map(value=>({label:value==='in_review'?'In review':value==='open'?'Open requests':'Resolved',value:items.filter(i=>i.status===value).length}))}/>
    <QueueToolbar query={query} onQuery={setQuery} placeholder="Search requests or order references" count={`${shown.length} of ${items.length} loaded`}><select aria-label="Support status filter" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option></select></QueueToolbar>
    <p className="buyer-help">Showing up to 100 recent requests, plus any case opened from the overview. Responses appear on the buyer&apos;s Contact &amp; support page.</p>
    {loadError?<p className="buyer-notice is-error" role="alert">Support requests could not load. Use Refresh to try again.</p>:!shown.length?<div className="dq-empty"><LifeBuoy size={28} aria-hidden/><h2>{items.length?'No matching requests':'No requests to review'}</h2><p>{items.length?'Try another search or status.':'New support requests will appear here.'}</p>{!!items.length&&<button className="buyer-btn" onClick={()=>{setQuery('');setStatus('all')}}>Clear filters</button>}</div>:shown.map(item=><article className="aw-support-card aw-case-anchor" id={`support-${item.id}`} key={item.id}><header><div><h2>{item.subject}</h2><p className="buyer-help">Reference {item.id.slice(0,8).toUpperCase()}{item.order_id&&` · Order ${item.order_id.slice(0,8).toUpperCase()}`} · {new Date(item.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</p></div><span className="aw-pill">{item.status.replace('_',' ')}</span></header><div className="aw-support-body">{item.body}</div><ReplyForm id={item.id} status={item.status} reply={item.admin_reply??''}/></article>)}
  </section>
}
