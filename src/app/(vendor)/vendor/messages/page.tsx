import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { vendorSession } from '@/lib/vendor/server'
import { PageHeading, EmptyState } from '@/components/vendor/Workspace'
import InboxRefresh from '@/app/(store)/messages/InboxRefresh'
import type { Conversation } from '@/app/(store)/messages/page'

export default async function VendorMessagesPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=Math.max(1,Math.min(5000,Number.parseInt((await searchParams).page??'1')||1))
  const { supabase } = await vendorSession('/vendor/messages')
  const { data, error } = await supabase.rpc('cm_conversations_page',{p_offset:(page-1)*20})
  if (error) throw new Error('Could not load your conversations.')
  const rows = (data ?? []) as Conversation[]
  return <div className="vx-page"><PageHeading eyebrow="Stay connected" title="Your conversations" description="Answer questions, agree on the details, and keep buyers in the loop." /><InboxRefresh />{!rows.length ? <section className="vx-panel"><EmptyState title="Your inbox is ready">Conversations appear here when someone messages your store. Your existing CampusMart conversations also appear here.</EmptyState></section> : <div className="vx-conversations">{rows.slice(0,20).map(c => <Link href={`/vendor/messages/${c.id}`} key={c.id} className="vx-conversation"><span className="vx-conversation-avatar"><MessageCircle size={20} strokeWidth={1.6} /></span><div className="vx-conversation-main"><h2>{c.other_name}</h2><p>{c.last_message?.slice(0, 160) || 'No messages yet. Say hello.'}</p></div><div className="vx-conversation-meta"><time dateTime={c.updated_at}>{new Date(c.updated_at).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' })}</time>{Number(c.unread_count) > 0 && <strong aria-label={`${c.unread_count} unread messages`}>{Number(c.unread_count) > 99 ? '99+' : c.unread_count}</strong>}</div></Link>)}</div>}<nav className="buyer-actions" aria-label="Inbox pages">{page>1&&<Link className="buyer-btn" href={`/vendor/messages?page=${page-1}`}>Previous</Link>}{rows.length>20&&<Link className="buyer-btn" href={`/vendor/messages?page=${page+1}`}>Next</Link>}</nav><p className="vx-chat-help">All your CampusMart conversations are available here. Need help with a buyer? <Link href="/contact">Contact support</Link>.</p></div>
}
