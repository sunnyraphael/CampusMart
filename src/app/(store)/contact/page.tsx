import Link from 'next/link'
import { BuyerPage, DataError } from '@/components/buyer/Page'
import { createClient } from '@/lib/supabase/server'
import { siteConfig } from '@/config/site'
import ContactForm from './ContactForm'

export default async function ContactPage() {
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  const requests=user?await supabase.from('support_requests').select('id,subject,status,admin_reply,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20):null
  const orders=user?await supabase.from('orders').select('id,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100):null
  return <BuyerPage title="Contact support" description="Tell us what happened and include the order reference when you have one.">
    <div className="buyer-columns"><section className="buyer-panel"><h2>Send a request</h2>{user?<ContactForm orders={orders?.data??[]}/>:<><p>Sign in to send and track a support request.</p><Link className="buyer-btn is-primary" href="/login?redirectTo=%2Fcontact">Sign in to contact support</Link></>}</section>
    <section className="buyer-panel"><h2>Need help signing in?</h2><p>Email <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a> from the email address associated with your account.</p><p>Never include passwords, card details, PINs or identity documents in a support message.</p><Link className="buyer-btn" href="/help">Read common questions</Link></section></div>
    {user&&<section className="buyer-stack"><h2>Your recent requests</h2>{requests?.error?<DataError/>:!requests?.data?.length?<p className="buyer-help">You have not sent any requests yet.</p>:requests.data.map((r)=><article className="buyer-panel" key={r.id}><div className="buyer-row"><h3>{r.subject}</h3><span className="buyer-status">{r.status.replaceAll('_',' ')}</span></div><p className="buyer-help">Reference {r.id.slice(0,8).toUpperCase()} - {new Date(r.created_at).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos'})}</p>{r.admin_reply&&<p>{r.admin_reply}</p>}</article>)}</section>}
  </BuyerPage>
}
