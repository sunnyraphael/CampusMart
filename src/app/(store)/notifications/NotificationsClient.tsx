'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { markNotificationsRead } from '@/lib/buyer/actions'
import { useBuyerAccount } from '@/components/buyer/BuyerAccount'

type Row={id:string;message:string;is_read:boolean|null;created_at:string|null;order_id:string|null}
export default function NotificationsClient({rows}:{rows:Row[]}) {
  const [filter,setFilter]=useState('all')
  const [busy,setBusy]=useState(false)
  const {refresh}=useBuyerAccount()
  const router=useRouter()
  async function mark(id?:string) {
    setBusy(true)
    try {const r=await markNotificationsRead(id);if('error'in r) toast.error(r.error);else {refresh();router.refresh()}}
    catch {toast.error('Could not update notifications.')}
    finally {setBusy(false)}
  }
  const shown=filter==='unread'?rows.filter((r)=>!r.is_read):rows
  return <div className="buyer-stack"><div className="buyer-row"><label className="buyer-label">Show<select className="buyer-input" value={filter} onChange={(e)=>setFilter(e.target.value)}><option value="all">All updates</option><option value="unread">Unread only</option></select></label><button className="buyer-btn" disabled={busy||!rows.some((r)=>!r.is_read)} onClick={()=>mark()}>Mark all as read</button></div>
    {!shown.length&&<p role="status">No unread notifications.</p>}
    {shown.map((r)=><article className="buyer-panel buyer-row" key={r.id}><div className="buyer-row-text"><p>{r.message}</p><span className="buyer-time">{r.created_at?new Date(r.created_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'}):''}</span></div><div className="buyer-actions">{!r.is_read&&<button className="buyer-btn" disabled={busy} onClick={()=>mark(r.id)}>Mark read</button>}{r.order_id&&<Link className="buyer-btn" href={`/orders#order-${r.order_id}`}>View order</Link>}</div></article>)}
    <p className="buyer-help">Showing your latest 100 updates.</p>
  </div>
}
