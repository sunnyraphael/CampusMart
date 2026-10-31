'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '@/lib/buyer/actions'
import { messageSchema } from '@/lib/buyer/validation'
import { useBuyerAccount } from '@/components/buyer/BuyerAccount'

export type ChatMessage={id:string;conversation_id:string;sender_id:string;body:string;created_at:string}

export default function Thread({id,userId,initial,otherLabel='Vendor'}:{id:string;userId:string;initial:ChatMessage[];otherLabel?:string}) {
  const supabase=useMemo(()=>createClient(),[])
  const [messages,setMessages]=useState(initial)
  const [body,setBody]=useState('')
  const [busy,setBusy]=useState(false)
  const [olderBusy,setOlderBusy]=useState(false)
  const [hasOlder,setHasOlder]=useState(initial.length===50)
  const [error,setError]=useState('')
  const [syncError,setSyncError]=useState('')
  const history=useRef<HTMLDivElement>(null)
  const alive=useRef(true)
  const lastRead=useRef('')
  const {refresh:refreshAccount}=useBuyerAccount()
  const refresh=useCallback(async()=>{
    const result=await supabase.from('buyer_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50)
    if(!alive.current) return
    if(result.error) {setSyncError('New messages could not be loaded. Retrying automatically.');return}
    const rows=result.data as ChatMessage[]
    const el=history.current
    const atBottom=!el||el.scrollHeight-el.scrollTop-el.clientHeight<80
    setMessages((prev)=>[...new Map([...prev,...rows].map((m)=>[m.id,m])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)))
    setSyncError('')
    if(atBottom) requestAnimationFrame(()=>{if(history.current) history.current.scrollTop=history.current.scrollHeight})
    const latest=rows[0]
    if(latest&&!document.hidden&&lastRead.current!==latest.id) {
      const {error:readError}=await supabase.rpc('cm_read_conversation',{p_conversation_id:id,p_read_at:latest.created_at})
      if(readError&&alive.current) setSyncError('Messages loaded, but the read status could not be saved.')
      else {lastRead.current=latest.id;refreshAccount()}
    }
  },[id,supabase,refreshAccount])
  useEffect(()=>{
    alive.current=true
    const run=()=>{if(!document.hidden) void refresh().catch(()=>{if(alive.current) setSyncError('Connection interrupted. Retrying automatically.')})}
    run();const timer=setInterval(run,5000);window.addEventListener('focus',run)
    return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('focus',run)}
  },[refresh])
  async function loadOlder() {
    const first=messages[0];if(!first)return
    setOlderBusy(true)
    try {
      const r=await supabase.from('buyer_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',id)
        .or(`created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50)
      if(r.error)throw r.error
      const rows=r.data as ChatMessage[]
      setMessages((prev)=>[...rows.reverse(),...prev]);setHasOlder(rows.length===50)
    } catch {setError('Older messages could not be loaded. Please try again.')} finally {setOlderBusy(false)}
  }
  async function submit(e:FormEvent) {
    e.preventDefault();setError('')
    const parsed=messageSchema.safeParse(body)
    if(!parsed.success) {setError(parsed.error.issues[0].message);return}
    setBusy(true)
    try {const r=await sendMessage(id,parsed.data);if('error'in r)setError(r.error);else {setBody('');await refresh();if(history.current) history.current.scrollTop=history.current.scrollHeight}}
    catch {setError('Could not send this message. Your draft is still here.')}
    finally {setBusy(false)}
  }
  return <div className="buyer-panel buyer-stack">
    {hasOlder&&<div><button className="buyer-btn" disabled={olderBusy} onClick={loadOlder}>{olderBusy?'Loading…':'Load earlier messages'}</button></div>}
    {syncError&&<p className="buyer-notice" role="status">{syncError}</p>}
    <div className="chat-history" ref={history} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
      {!messages.length&&<p className="buyer-help">No messages yet. Ask about availability, condition, or delivery.</p>}
      {messages.map((m)=><article className={`chat-bubble${m.sender_id===userId?' is-mine':''}`} key={m.id}><span className="sr-only">{m.sender_id===userId?'You':otherLabel}: </span><p>{m.body}</p><time className="buyer-time" dateTime={m.created_at}>{new Date(m.created_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></article>)}
    </div>
    {error&&<p className="buyer-notice is-error" role="alert">{error}</p>}
    <form className="chat-composer" onSubmit={submit}><label className="buyer-label buyer-row-text"><span className="sr-only">Message</span><textarea className="buyer-input" value={body} onChange={(e)=>setBody(e.target.value)} maxLength={2000} required placeholder="Write a message…" disabled={busy}/></label><button className="buyer-btn is-primary" disabled={busy||!body.trim()} aria-label="Send message"><Send size={18} aria-hidden="true"/></button></form>
    <p className="buyer-help">Messages refresh automatically while this page is open. Keep payment and order discussions on CampusMart.</p>
  </div>
}
