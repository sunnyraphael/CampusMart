import Link from 'next/link'
import { ArrowRight, ChevronRight, ShieldCheck, PackageCheck, ShieldAlert, LifeBuoy, ClipboardCheck, LockKeyhole, FlaskConical, CheckCircle2 } from 'lucide-react'
import { adminSession } from '@/lib/admin/server'
import { buildAdminFocus } from '@/lib/admin/queues'
import AdminRefresh from '@/components/admin/RefreshButton'
import type { DeliveryApproval } from './deliveries/DeliveriesClient'

export default async function AdminOverview() {
  const {supabase}=await adminSession()
  const [deliveries,held,verifications,disputes,support]=await Promise.all([
    supabase.rpc('cm_admin_delivery_queue',{p_view:'pending',p_page:1}),
    supabase.rpc('cm_admin_delivery_queue',{p_view:'held',p_page:1}),
    supabase.rpc('admin_kyc_queue'),
    supabase.rpc('cm_admin_order_disputes',{p_resolved:false}),
    supabase.from('support_requests').select('id,subject,status,created_at',{count:'exact'}).neq('status','resolved').order('created_at',{ascending:false}).limit(6),
  ])
  const pending=(deliveries.data??[]) as DeliveryApproval[]
  const holds=(held.data??[]) as DeliveryApproval[]
  const verificationRows=(verifications.data??[]) as {seller_id:string;store_name:string;submitted_at:string|null}[]
  const disputeRows=(disputes.data??[]) as {item_id:string;product_title:string|null;store_name:string|null;ordered_at:string|null}[]
  const supportRows=(support.data??[]) as {id:string;subject:string;status:string;created_at:string|null}[]
  const focus=buildAdminFocus({deliveries:pending.slice(0,20),held:holds.slice(0,20),verifications:verificationRows,disputes:disputeRows,support:supportRows})
  const count=(n:number,cap:number)=>(n>cap||cap===100&&n===cap)?`${cap}+`:String(n)
  const cards=[
    {label:'Delivery reviews',value:deliveries.error?'\u2014':count(pending.length,20),detail:held.error?'Hold summary unavailable':`${count(holds.length,20)} on hold`,href:'/admin/deliveries',icon:PackageCheck},
    {label:'Vendor verifications',value:verifications.error?'\u2014':String(verificationRows.length),detail:'Submissions in the review queue',href:'/admin/verifications',icon:ShieldCheck},
    {label:'Open disputes',value:disputes.error?'\u2014':count(disputeRows.length,100),detail:'Buyer reports awaiting a decision',href:'/admin/disputes',icon:ShieldAlert},
    {label:'Support waiting',value:support.error?'\u2014':String(support.count??supportRows.length),detail:'Open and in-review requests',href:'/admin/support',icon:LifeBuoy},
  ]
  const failed=[deliveries,held,verifications,disputes,support].some(r=>r.error)
  const icons={delivery:PackageCheck,verification:ShieldCheck,dispute:ShieldAlert,support:LifeBuoy}
  return <section>
    <div className="aw-overview-hero"><div><span className="aw-eyebrow">Marketplace operations</span><h1>Your admin overview</h1><p>Keep orders moving, review vendors and help your campus community. Start with the cases that need a decision.</p><div className="buyer-actions"><Link className="buyer-btn is-primary" href="/admin/deliveries">Review deliveries <ArrowRight size={15} aria-hidden/></Link><AdminRefresh/></div></div><div className="aw-hero-symbol" aria-hidden><ShieldCheck size={46} strokeWidth={1.4}/></div></div>
    {failed&&<p className="buyer-notice is-error" role="alert">Some queue summaries could not load. Refresh to try again, or open the relevant queue.</p>}
    <div className="aw-stats" aria-label="Review queue summary">{cards.map(({label,value,detail,href,icon:Icon})=><Link className="aw-stat" href={href} key={href}><span className="aw-stat-top">{label}<Icon size={19} aria-hidden/></span><strong>{value}</strong><small>{detail}</small></Link>)}</div>
    <div className="aw-overview-grid"><section className="aw-panel"><header className="aw-panel-head"><div><h2>Review next</h2><p>Priority cases from your current review queues.</p></div><ClipboardCheck size={20} aria-hidden/></header>{!focus.length?<div className="dq-empty"><CheckCircle2 size={29} aria-hidden/><h2>{failed?'Queue summaries unavailable':'You are all caught up'}</h2><p>{failed?'Refresh to load the current work queues.':'New cases will appear here when they need a review.'}</p></div>:focus.map(row=>{const Icon=icons[row.kind];return <Link href={row.href} className="aw-review-row" key={row.key}><span className="aw-row-icon"><Icon size={18} aria-hidden/></span><span className="aw-row-copy"><strong>{row.title}</strong><small>{row.detail}</small></span><span className="aw-pill">{row.label}</span><ChevronRight size={16} aria-hidden/></Link>})}</section>
    <aside className="aw-side-stack"><section className="aw-panel"><header className="aw-panel-head"><h2>Before approving credit</h2><LockKeyhole size={19} aria-hidden/></header><ul className="aw-note-list"><li><CheckCircle2 size={17} aria-hidden/><span><strong>Check the evidence</strong>Confirm payment verification, handover code and buyer receipt.</span></li><li><ShieldAlert size={17} aria-hidden/><span><strong>Keep unresolved issues on hold</strong>Review disputes before approving a delivery.</span></li><li><FlaskConical size={17} aria-hidden/><span><strong>Trials stay separate</strong>Trial approvals never create real vendor funds.</span></li></ul></section><section className="aw-panel"><header className="aw-panel-head"><h2>A connected workspace</h2></header><p className="aw-description">Use the navigation to move between queues. Review next links take you straight to the relevant case.</p><Link className="aw-inline-link" href="/admin/support" style={{marginTop:18}}>Open support requests <ArrowRight size={14} aria-hidden/></Link></section></aside></div>
    <p className="aw-last-loaded">Last loaded {new Date().toLocaleString('en-NG',{timeZone:'Africa/Lagos',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}. Counts with + indicate more cases in that queue.</p>
  </section>
}
