'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {useTransactionPin} from '@/components/admin/TransactionPin'
import { reconcileFinanceJob,refreshPaymentQueue } from '@/lib/paystack/actions'
import { formatPrice } from '@/lib/utils/format'
import { refundPreview } from '@/lib/paystack/amounts'
type Payment={order_id:string;reference:string;amount_kobo:number;provider_fee_kobo:number|null;mode:string;state:string}
export type FinanceItem={id:string;order_id:string;seller_id:string;subtotal:number;payout_amount:number|null;fulfillment_status:string;released_at:string|null;products:{title:string}|null;sellers:{store_name:string}|null}
type Refund={id:string;order_id:string;amount_kobo:number;processing_fee_retained_kobo:number;state:string;note:string}
type Transfer={id:string;item_id:string;reference:string;mode:string;amount_kobo:number;account_name:string;bank_name:string;last_four:string;state:string}
type View='payments'|'refunds'|'transfers'
type Status='all'|'pending'|'successful'|'failed'
function statusGroup(state:string):Exclude<Status,'all'>{
  if(['paid','processed','success','refunded'].includes(state))return 'successful'
  if(['failed','reversed','abandoned','rejected','cancelled','expired'].includes(state))return 'failed'
  return 'pending'
}
const viewLabels={payments:'Recent payments',refunds:'Refund jobs',transfers:'Transfer jobs'}
const statusLabels={all:'All',pending:'Pending',successful:'Successful',failed:'Failed'}
type Recipient={seller_id:string;account_name:string;bank_name:string;last_four:string;updated_at:string}
export default function FinanceClient({payments,items,refunds,transfers,recipients}:{payments:Payment[];items:FinanceItem[];refunds:Refund[];transfers:Transfer[];recipients:Recipient[]}){
  const {authorize,prompt}=useTransactionPin()
  const router=useRouter(),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[query,setQuery]=useState('')
  const [view,setView]=useState<View>('payments'),[status,setStatus]=useState<Status>('all')
  const [recordedItems,setRecordedItems]=useState<string[]>([])
  const [panel,setPanel]=useState<{kind:'refund'|'transfer';order:string;item:string}|null>(null),[note,setNote]=useState(''),[confirmed,setConfirmed]=useState(false),[deduct,setDeduct]=useState(false)
  async function run(action:()=>Promise<{ok:true}|{error:string}>){if(busy)return;setBusy(true);setNotice('');try{const result=await action();setNotice('error'in result?result.error:'Request recorded. Check its provider status below; queued or pending does not mean money has arrived.');if(!('error'in result)){if(panel){setView(panel.kind==='refund'?'refunds':'transfers');setStatus('all');setQuery('');if(panel.kind==='transfer')setRecordedItems(current=>[...current,panel.item])}setPanel(null);router.refresh()}}catch{setNotice('The result could not be confirmed. Refresh and reconcile the existing job before trying another request.')}finally{setBusy(false)}}
  function open(kind:'refund'|'transfer',order:string,item=''){setPanel({kind,order,item});setNote('');setConfirmed(false);setDeduct(false)}
  const payment=payments.find(p=>p.order_id===panel?.order),selected=items.find(i=>i.id===panel?.item)
  const recipient=recipients.find(r=>r.seller_id===selected?.seller_id)
  const preview=payment?refundPreview(payment,items.filter(i=>i.order_id===payment.order_id),refunds.filter(r=>r.order_id===payment.order_id),panel?.item??'',deduct):{amount:0,retained:0}
  const matches=(state:string,text:string)=>(status==='all'||statusGroup(state)===status)&&text.toLowerCase().includes(query.trim().toLowerCase())
  const shownPayments=payments.filter(p=>matches(p.state,p.reference+' '+p.order_id))
  const shownRefunds=refunds.filter(r=>matches(r.state,r.order_id+' '+r.id+' '+r.note))
  const shownTransfers=transfers.filter(t=>matches(t.state,t.reference+' '+t.account_name+' '+t.bank_name))
  const currentRows=view==='payments'?payments:view==='refunds'?refunds:transfers
  const shownCount=view==='payments'?shownPayments.length:view==='refunds'?shownRefunds.length:shownTransfers.length
  function changeView(next:View){setView(next);setStatus('all');setQuery('');setPanel(null)}
  return <div className="buyer-stack">
    <Link href="/admin-security?pin=1">Admin password & transaction PIN</Link>
    <p className="buyer-notice">Test payments and transfers never affect real vendor balances. Live transfers use funds in your Paystack balance and may need Paystack approval/OTP. Unknown refund results must be reconciled; do not send a second refund from the dashboard without checking this record.</p>
    <div className="buyer-actions"><label>Search loaded records<input className="buyer-input" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}/></label><button className="buyer-btn" disabled={busy} onClick={()=>void run(refreshPaymentQueue)}>Reconcile payment queue</button></div>
    <div className="aw-view-tabs af-tabs" role="tablist" aria-label="Finance views">{(['payments','refunds','transfers'] as const).map(v=><button key={v} id={'finance-tab-'+v} role="tab" aria-selected={view===v} aria-controls="finance-records" onClick={()=>changeView(v)}>{viewLabels[v]} <span>{(v==='payments'?payments:v==='refunds'?refunds:transfers).length}</span></button>)}</div>
    <div className="af-filters" role="group" aria-label="Filter by status">{(['all','pending','successful','failed'] as const).map(value=><button key={value} className={'af-filter af-'+value} aria-pressed={status===value} onClick={()=>setStatus(value)}>{statusLabels[value]} <span>{currentRows.filter(row=>value==='all'||statusGroup(row.state)===value).length}</span></button>)}</div>
    {notice&&<p className="buyer-notice" role="status">{notice}</p>}
    {panel&&payment&&<section className="buyer-panel buyer-stack" aria-label="Confirm finance operation">
      <h2>{panel.kind==='refund'?'Review refund amount':'Review vendor transfer'}</h2>
      <p>Order {payment.order_id.slice(0,8)} · {payment.mode.toUpperCase()} · Paid {formatPrice(payment.amount_kobo/100)}</p>
      {panel.kind==='refund'?<>
        <label>Refund scope<select className="buyer-input" value={panel.item} onChange={e=>setPanel({...panel,item:e.target.value})}><option value="">Remaining whole-order balance (cancels all remaining items)</option>{items.filter(i=>i.order_id===panel.order&&['disputed','refunded'].includes(i.fulfillment_status)&&!i.released_at).map(i=><option key={i.id} value={i.id}>{i.products?.title??i.id.slice(0,8)} · item and allocated order charges</option>)}</select></label>
        <p>Actual Paystack processing fee: {payment.provider_fee_kobo===null?'not yet verified':formatPrice(payment.provider_fee_kobo/100)}. CampusMart service fee is returned on this reviewed refund; the voluntary-cancellation rule is separate.</p>
        <label className="by-check"><input type="checkbox" checked={deduct} disabled={payment.provider_fee_kobo===null} onChange={e=>setDeduct(e.target.checked)}/><span>Deduct the actual non-refundable Paystack processing fee only where this case lawfully permits it and the condition was disclosed before payment. For an item refund, only its allocated share is deducted. Do not select where a full statutory refund is owed.</span></label>
        <RefundPreview payment={payment} items={items.filter(i=>i.order_id===payment.order_id)} refunds={refunds.filter(r=>r.order_id===payment.order_id)} itemId={panel.item} deduct={deduct}/>
      </>:<><p>Transfer {formatPrice(Number(selected?.payout_amount??0))} to <strong>{recipient?.account_name??'Payout account not set'}</strong>, {recipient?.bank_name} ····{recipient?.last_four}. {payment.mode==='test'?'TEST transfer; no real funds.':'This sends real money after provider confirmation.'}</p><p>Verify beneficiary ownership and payout eligibility before confirming.</p></>}
      <label>Review note<textarea className="buyer-input" value={note} onChange={e=>setNote(e.target.value)} minLength={10} maxLength={1000} rows={3}/></label>
      <label className="by-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I reviewed the amount, refund scope or beneficiary, consumer rights and the supporting evidence. Any deduction is justified in my review note.</span></label>
      <div className="buyer-actions"><button className="buyer-btn is-primary" disabled={busy||!confirmed||note.trim().length<10||(panel.kind==='transfer'&&!recipient)} onClick={()=>void run(()=>panel.kind==='refund'?authorize('refund',{p_order_id:panel.order,p_item_id:panel.item||null,p_deduct_processing:deduct,p_reviewed:true,p_note:note,p_expected_amount:preview.amount,p_expected_fee:preview.retained}):authorize('transfer',{p_item_id:panel.item,p_confirmed:true,p_note:note,p_recipient_updated_at:recipient?.updated_at??'',p_expected_amount:Math.round(Number(selected?.payout_amount??0)*100)}))}>{busy?'Recording…':panel.kind==='refund'?'Confirm refund request':'Confirm transfer request'}</button><button className="buyer-btn" disabled={busy} onClick={()=>setPanel(null)}>Keep unchanged</button></div>
    </section>}
    <section id="finance-records" role="tabpanel" aria-labelledby={'finance-tab-'+view} className="buyer-stack">
    <h2>{viewLabels[view]}</h2>
    <p className="buyer-help">{shownCount} matching {shownCount===1?'record':'records'}. {view==='payments'?'Latest loaded payments.':view==='refunds'?'Refunds for the loaded orders.':'Recent transfers and transfers linked to the loaded payments.'} Pending includes requests awaiting review, provider approval or reconciliation; the exact status is shown on each record.</p>
    {view==='payments'&&shownPayments.map(p=><article className="buyer-panel buyer-stack" key={p.order_id}>
      <div className="buyer-row"><strong>{p.mode.toUpperCase()} &middot; {formatPrice(p.amount_kobo/100)}</strong><span className={'af-status af-'+statusGroup(p.state)}>{p.state}</span></div>
      <code className="af-reference">{p.reference}</code><Link href="/admin/deliveries">Delivery approval queue</Link>
      <div className="buyer-actions"><button className="buyer-btn" disabled={busy||!['paid','review'].includes(p.state)} onClick={()=>open('refund',p.order_id)}>Review refund</button></div>
      {items.filter(i=>i.order_id===p.order_id).map(i=>{const existing=transfers.find(t=>t.item_id===i.id);return <div className="buyer-row" key={i.id}>
        <span>{i.products?.title??'Purchased item'} &middot; {i.sellers?.store_name} &middot; {i.fulfillment_status}</span>
        {i.released_at&&(existing||recordedItems.includes(i.id)?<button className="buyer-btn" onClick={()=>changeView('transfers')}>Transfer {existing?.state??'recorded'} &middot; View job</button>:<button className="buyer-btn" disabled={busy} onClick={()=>open('transfer',p.order_id,i.id)}>Transfer approved earnings</button>)}
      </div>})}
    </article>)}
    {view==='refunds'&&shownRefunds.map(r=><article className="buyer-panel buyer-stack" key={r.id}>
      <div className="buyer-row"><strong>{formatPrice(r.amount_kobo/100)}</strong><span className={'af-status af-'+statusGroup(r.state)}>{r.state}</span></div>
      <Link href={'/admin/payments?reference='+r.order_id}>Order {r.order_id.slice(0,8)}</Link><p className="buyer-help">{r.note}</p>
      {r.state==='needs-attention'&&<p>Complete the additional details for this existing refund in Paystack, then reconcile it here. Do not create another refund.</p>}
      <div className="buyer-actions"><button className="buyer-btn" disabled={busy} onClick={()=>void run(()=>reconcileFinanceJob({kind:'refund',id:r.id}))}>Reconcile refund</button>{r.state==='rejected'&&<button className="buyer-btn" disabled={busy} onClick={()=>void run(()=>authorize('retry_refund',{p_id:r.id}))}>Retry rejected refund request</button>}</div>
    </article>)}
    {view==='transfers'&&shownTransfers.map(t=><article className="buyer-panel buyer-stack" key={t.id}>
      <div className="buyer-row"><strong>{t.mode.toUpperCase()} &middot; {formatPrice(t.amount_kobo/100)}</strong><span className={'af-status af-'+statusGroup(t.state)}>{t.state}</span></div>
      <p>{t.account_name} &middot; {t.bank_name} &middot; ****{t.last_four}</p><code className="af-reference">{t.reference}</code>
      {t.state==='otp'&&<p className="buyer-notice">Complete the approval for this existing transfer in Paystack. Do not create a replacement transfer.</p>}
      {['failed','reversed','abandoned'].includes(t.state)&&<p className="buyer-help">This transfer did not complete or was reversed/cancelled. Test mode alone does not explain a failure. Review this reference in Paystack before taking further action.</p>}
      <div className="buyer-actions"><button className="buyer-btn" disabled={busy} onClick={()=>void run(()=>reconcileFinanceJob({kind:'transfer',id:t.id}))}>Reconcile transfer</button>{['queued','blocked'].includes(t.state)&&<button className="buyer-btn" disabled={busy} onClick={()=>void run(()=>authorize('cancel_transfer',{p_id:t.id,p_note:'Administrator cancelled the unsent transfer after checking the recorded status.'}))}>Cancel unsent transfer; restore wallet</button>}</div>
    </article>)}
    {!shownCount&&<p className="buyer-notice">No {status==='all'?'':statusLabels[status].toLowerCase()+' '}{viewLabels[view].toLowerCase()} match this view.</p>}
    </section>
    {prompt}
  </div>
}
function RefundPreview({payment,items,refunds,itemId,deduct}:{payment:Payment;items:FinanceItem[];refunds:Refund[];itemId:string;deduct:boolean}){
  const preview=refundPreview(payment,items,refunds,itemId,deduct)
  return <p className="buyer-notice">Refund preview: {formatPrice(preview.amount/100)}. Processing fee retained: {formatPrice(preview.retained/100)}. The database rechecks scope, previous refunds and funds before recording this amount.</p>
}
