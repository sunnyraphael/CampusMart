'use client'
import Link from 'next/link'
import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Store, FileClock, ArrowUpRight, CircleHelp } from 'lucide-react'
import { cancelAccountChange, requestAccountChange, setStoreClosed } from '@/lib/account/actions'
import { accountRequestLabels, type AccountControlsState, type AccountRequestKind } from '@/lib/account/types'

export default function AccountControls({state}:{state:AccountControlsState}) {
  const router=useRouter()
  const [kind,setKind]=useState<AccountRequestKind>('delete_data')
  const [note,setNote]=useState('')
  const [confirmed,setConfirmed]=useState(false)
  const [storeConfirm,setStoreConfirm]=useState(false)
  const [busy,setBusy]=useState(false)
  const [refreshing,startTransition]=useTransition()
  const [result,setResult]=useState({error:'',ok:''})
  const locked=busy||refreshing
  async function perform(action:()=>Promise<{ok:true}|{error:string}>,success:string){
    if(locked)return
    setBusy(true);setResult({error:'',ok:''})
    try{const response=await action();if('error'in response){setResult({error:response.error,ok:''});return}setResult({error:'',ok:success});setConfirmed(false);setStoreConfirm(false);setNote('');startTransition(()=>router.refresh())}catch{setResult({error:'The change could not be saved. Please retry.',ok:''})}finally{setBusy(false)}
  }
  function submit(e:FormEvent){e.preventDefault();void perform(()=>requestAccountChange({kind,note,confirmed}),'Request received. Follow its progress below; no personal data has been erased by submitting it.')}
  const openStore=state.has_store&&!state.store_closed_at
  return <div className="ac-layout">
    <aside className="ac-aside"><ShieldCheck size={28} aria-hidden/><h2>Your account, your choices</h2><p>Choose what you want to close or ask us to remove. We will explain what can be deleted and what needs to be kept.</p><Link href="/privacy">Read the privacy policy <ArrowUpRight size={14} aria-hidden/></Link><Link href="/contact">Contact support <ArrowUpRight size={14} aria-hidden/></Link></aside>
    <div className="ac-stack">
      {!state.active&&<section className="buyer-panel ac-status" id="account-controls"><ShieldCheck size={23} aria-hidden/><div><h2>Your account is closed</h2><p>Purchasing, messaging and store activity are disabled. These privacy controls and support remain available. Closing an account does not erase retained order or dispute records.</p></div></section>}
      {result.error&&<p className="buyer-notice is-error" role="alert">{result.error}</p>}{result.ok&&<p className="buyer-notice is-success" role="status">{result.ok}</p>}
      {state.has_store&&<section className="buyer-panel" id="store-controls"><div className="ac-section-title"><Store size={21} aria-hidden/><h2>Your store</h2><span className="ac-pill">{openStore?'Open':'Closed'}</span></div><p className="buyer-help">{openStore?'Close your store immediately while keeping your buyer account. Active listings become drafts and new purchases from your store stop. You can still handle existing orders, disputes and payouts.':'Your listings are unpublished. Reopening allows you to publish them again individually; it does not automatically restore any listing.'}</p>{state.active&&<><label className="ac-check"><input type="checkbox" checked={storeConfirm} onChange={e=>setStoreConfirm(e.target.checked)} disabled={locked}/><span>{openStore?'I understand that closing the store stops new sales and leaves existing obligations in place.':'I want to reopen this store and choose which listings to publish.'}</span></label><button className="buyer-btn" disabled={locked||!storeConfirm} onClick={()=>void perform(()=>setStoreClosed(openStore),openStore?'Your store is closed. Your buyer account remains available.':'Your store is open. Publish the listings you want to offer again.')}>{locked?'Please wait...':openStore?'Close store only':'Reopen store'}</button></>}</section>}
      <section className="buyer-panel" id="privacy-controls"><div className="ac-section-title"><ShieldCheck size={21} aria-hidden/><h2>Privacy and account requests</h2></div><p className="buyer-help">Account closure and data removal need review so open orders, disputes and balances can be settled. Submitting this form does not instantly close your account or erase data.</p>
        <form className="buyer-form" onSubmit={submit}><fieldset className="ac-options"><legend>What would you like to do?</legend>{(Object.keys(accountRequestLabels) as AccountRequestKind[]).filter(value=>state.active||value==='delete_data').map(value=><label className="ac-option" key={value}><input type="radio" name="account-request" value={value} checked={kind===value} onChange={()=>{setKind(value);setConfirmed(false)}} disabled={locked||(value==='close_account'&&openStore)||(value==='close_both'&&!state.has_store)}/><span><strong>{accountRequestLabels[value]}</strong><small>{value==='delete_data'?'Ask for eligible data to be removed without closing your account. Necessary transaction, dispute and security records may be retained.':value==='close_account'?openStore?'Close the store first, or choose account and store together.':'Request account deactivation. Your account stays active until an administrator approves the request.':'Close the store now and request account deactivation after outstanding obligations are resolved.'}</small></span></label>)}</fieldset><label>Details (optional)<textarea className="buyer-input" value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={3} placeholder="Tell us which data you want removed or anything we should consider. Avoid passwords, payment details or ID documents."/></label><label className="ac-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={locked} required/><span>I understand this request needs review, and records needed for open orders, disputes or legal obligations may be retained.{kind==='close_both'?' My store will close immediately.':''}</span></label><div className="buyer-actions"><button className="buyer-btn is-primary" disabled={locked||!confirmed}>{locked?'Submitting...':'Submit request'}</button><Link className="buyer-btn" href="/contact"><CircleHelp size={15} aria-hidden/>Ask a question</Link></div></form>
      </section>
      <section className="buyer-panel" aria-labelledby="request-history"><div className="ac-section-title"><FileClock size={21} aria-hidden/><h2 id="request-history">Your requests</h2></div>{!state.requests.length?<p className="buyer-help">Your privacy and closure requests will appear here.</p>:<div className="ac-request-list">{state.requests.map(request=><article className="ac-request" key={request.id}><header><h3>{accountRequestLabels[request.kind]}</h3><span className="ac-pill">{request.status.replace('_',' ')}</span></header><p className="buyer-help">Reference {request.id.slice(0,8).toUpperCase()} &middot; {new Date(request.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</p>{request.note&&<p className="buyer-preserve-lines">{request.note}</p>}{request.admin_note&&<p className="ac-reply"><strong>Review update</strong>{request.admin_note}</p>}{request.status==='pending'&&<button className="buyer-btn" disabled={locked} onClick={()=>void perform(()=>cancelAccountChange(request.id),'Request cancelled. If you closed a store, it remains closed until you choose to reopen it.')}>Cancel request</button>}</article>)}</div>}</section>
    </div>
  </div>
}
