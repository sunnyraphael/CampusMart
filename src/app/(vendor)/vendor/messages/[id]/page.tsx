import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { vendorSession } from '@/lib/vendor/server'
import { uuid } from '@/lib/buyer/validation'
import { PageHeading } from '@/components/vendor/Workspace'
import type { Conversation } from '@/app/(store)/messages/page'
import Thread, { type ChatMessage } from '@/app/(store)/messages/[id]/Thread'

export default async function VendorConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuid.safeParse(id).success) notFound()
  const { supabase, user } = await vendorSession(`/vendor/messages/${id}`)
  const { data, error } = await supabase.rpc('cm_conversations')
  if (error) throw new Error('Could not load your conversation.')
  const conversation = ((data ?? []) as Conversation[]).find(c => c.id === id)
  if (!conversation) notFound()
  const result = await supabase.from('buyer_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50)
  if (result.error) throw new Error('Could not load these messages.')
  return <div className="vx-page"><Link className="od-back" href="/vendor/messages"><ArrowLeft size={15} />All conversations</Link><PageHeading eyebrow="Messages" title={conversation.other_name} description="Keep the details together, from the first question to delivery." actions={conversation.product_id ? <Link href={`/products/${conversation.product_id}`} className="vx-btn vx-btn-secondary">View listing<ArrowUpRight size={15} /></Link> : undefined} /><Thread key={id} id={id} userId={user.id} initial={((result.data ?? []) as ChatMessage[]).reverse()} otherLabel={conversation.other_name} /></div>
}
