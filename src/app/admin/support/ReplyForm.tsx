'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { replySupport } from './actions'

export default function ReplyForm({id,status:initial,reply:initialReply}:{id:string;status:string;reply:string}) {
  const router=useRouter()
  const [status,setStatus]=useState(initial)
  const [reply,setReply]=useState(initialReply)
  const [busy,setBusy]=useState(false)
  const [result,setResult]=useState('')
  const [failed,setFailed]=useState(false)
  async function submit(e:FormEvent) {
    e.preventDefault();if(busy)return;setBusy(true);setResult('');setFailed(false)
    try{const r=await replySupport({id,status,reply});setFailed('error'in r);setResult('error'in r?r.error:'Response saved.');if('ok'in r)router.refresh()}catch{setFailed(true);setResult('Could not save the response.')}finally{setBusy(false)}
  }
  return <form className="buyer-form" onSubmit={submit}><label>Status<select className="buyer-input" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option></select></label><label>Response to buyer<textarea className="buyer-input" value={reply} onChange={(e)=>setReply(e.target.value)} maxLength={4000} required/></label>{result&&<p role={failed?'alert':'status'}>{result}</p>}<div><button className="buyer-btn is-primary" disabled={busy}>{busy?'Saving…':'Save response'}</button></div></form>
}
