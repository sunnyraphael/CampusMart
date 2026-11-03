import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { BuyerPage, DataError, EmptyState } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import InboxRefresh from './InboxRefresh'

export type Conversation={id:string;other_name:string;product_id:string|null;updated_at:string;last_message:string|null;unread_count:number}

export default async function MessagesPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=Math.max(1,Math.min(5000,Number.parseInt((await searchParams).page??'1')||1))
  const {supabase}=await buyerSession('/messages')
  const {data,error}=await supabase.rpc('cm_conversations_page',{p_offset:(page-1)*20})
  const rows=(data??[]) as Conversation[]
  return <BuyerPage title="Messages" description="Talk to vendors about a listing or an order without sharing your phone number.">
    <InboxRefresh/>
    {error?<DataError/>:!rows.length?<EmptyState title="Start a conversation">Choose Message vendor on a listing or a vendor storefront.</EmptyState>:<div className="buyer-stack">{rows.slice(0,20).map((c)=><Link href={`/messages/${c.id}`} className="buyer-panel buyer-row chat-list-link" key={c.id}>
      <MessageCircle size={22} aria-hidden="true"/><div className="buyer-row-text"><h2>{c.other_name}</h2><p>{c.last_message?.slice(0,120)||'No messages yet. Say hello.'}</p></div><span className="buyer-time">{new Date(c.updated_at).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos'})}</span>{Number(c.unread_count)>0&&<span className="site-badge" aria-label={`${c.unread_count} unread messages`}>{Number(c.unread_count)>99?'99+':c.unread_count}</span>}
    </Link>)}</div>}
    <nav className="buyer-actions" aria-label="Inbox pages">{page>1&&<Link className="buyer-btn" href={`/messages?page=${page-1}`}>Previous</Link>}{rows.length>20&&<Link className="buyer-btn" href={`/messages?page=${page+1}`}>Next</Link>}</nav>
    <p className="buyer-help">Keep conversations respectful. Never send passwords, PINs, or card details. <Link href="/contact">Contact support</Link> if a conversation makes you uncomfortable.</p>
  </BuyerPage>
}
