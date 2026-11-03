import { adminSession } from '@/lib/admin/server'
import { paymentConfig,paymentService } from '@/lib/paystack/config'
import { AdminHeading } from '@/components/admin/Workspace'
import AdminRefresh from '@/components/admin/RefreshButton'
import FinanceClient from './FinanceClient'
export default async function PaymentsPage({searchParams}:{searchParams:Promise<{reference?:string}>}){
  await adminSession()
  const {reference:rawReference=''}=await searchParams
  const reference=/^(cm-[a-f0-9]{32}|[a-f0-9-]{36})$/.test(rawReference)?rawReference:''
  let mode:string
  try{mode=paymentConfig().mode}catch{return <section><AdminHeading title="Payments & refunds" description="Paystack setup is incomplete."/><p className="buyer-notice">Set the server-only Paystack key, payment mode, site URL and reconciliation secret, then apply the payment migrations. Do not paste keys into support messages.</p></section>}
  const service=paymentService()
  let paymentQuery=service.from('paystack_payments').select('order_id,reference,amount_kobo,provider_fee_kobo,mode,state,created_at').eq('mode',mode).order('created_at',{ascending:false}).limit(10)
  if(reference)paymentQuery=paymentQuery.eq(reference.startsWith('cm-')?'reference':'order_id',reference)
  const payments=await paymentQuery
  const ids=(payments.data??[]).map(p=>p.order_id)
  // Ten orders contain at most 500 items and 510 durable refund jobs. Load every
  // refund for these orders so the preview includes all previous deductions.
  const refunds=ids.length?await service.from('paystack_refunds').select('id,order_id,item_id,amount_kobo,processing_fee_retained_kobo,state,note,created_at').in('order_id',ids).order('created_at',{ascending:false}):{data:[],error:null}
  const transfers=await service.from('paystack_transfers').select('id,item_id,reference,mode,amount_kobo,account_name,bank_name,last_four,state,created_at').eq('mode',mode).order('created_at',{ascending:false}).limit(60)
  const items=ids.length?await service.from('order_items').select('id,order_id,seller_id,subtotal,payout_amount,fulfillment_status,released_at,products(title),sellers(store_name)').in('order_id',ids):{data:[],error:null}
  // A reference search may select an older payment. Its transfer must still
  // suppress the approval button even when outside the latest 60 jobs.
  const itemIds=(items.data??[]).map(item=>item.id)
  const linkedTransfers=itemIds.length?await service.from('paystack_transfers').select('id,item_id,reference,mode,amount_kobo,account_name,bank_name,last_four,state,created_at').eq('mode',mode).in('item_id',itemIds).order('created_at',{ascending:false}):{data:[],error:null}
  const allTransfers=[...new Map([...(transfers.data??[]),...(linkedTransfers.data??[])].map(job=>[job.id,job])).values()].sort((a,b)=>b.created_at.localeCompare(a.created_at))
  const sellerIds=[...new Set((items.data??[]).map(i=>i.seller_id))]
  const recipients=sellerIds.length?await service.from('paystack_recipients').select('seller_id,account_name,bank_name,last_four,updated_at').eq('mode',mode).in('seller_id',sellerIds):{data:[],error:null}
  const failed=payments.error||refunds.error||transfers.error||linkedTransfers.error||items.error||recipients.error
  return <section className="buyer-stack"><AdminHeading title="Payments & refunds" description={`Paystack ${mode.toUpperCase()} environment. Review exact amounts, fees and beneficiaries before sending money.`} actions={<AdminRefresh/>}/><form className="buyer-panel buyer-stack" action="/admin/payments"><label>Find any payment by its full reference or order ID<input className="buyer-input" name="reference" defaultValue={rawReference} maxLength={40}/></label><button className="buyer-btn">Find payment</button><p className="buyer-help">Without a reference, the latest ten payments are shown. Refund jobs belong to the displayed orders; the latest 60 transfer jobs and any older jobs linked to these payments are included.</p></form>{failed?<p className="buyer-notice is-error" role="alert">Finance data could not load. Check migrations and refresh.</p>:<FinanceClient payments={payments.data??[]} items={(items.data??[]) as unknown as import('./FinanceClient').FinanceItem[]} refunds={refunds.data??[]} transfers={allTransfers} recipients={recipients.data??[]}/>}</section>
}
