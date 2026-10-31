import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BuyerPage, DataError } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import { uuid } from '@/lib/buyer/validation'
import type { Conversation } from '../page'
import Thread, { type ChatMessage } from './Thread'

export default async function ConversationPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if(!uuid.safeParse(id).success) notFound()
  const {supabase,user}=await buyerSession(`/messages/${id}`)
  const {data,error}=await supabase.rpc('cm_conversations')
  if(error) return <DataError/>
  const conversation=(data as Conversation[]).find((c)=>c.id===id)
  if(!conversation) notFound()
  const result=await supabase.from('buyer_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50)
  return <BuyerPage title={conversation.other_name} description="Your conversation stays on CampusMart." actions={<Link className="buyer-btn" href="/messages">All messages</Link>}>
    {conversation.product_id&&<Link className="buyer-btn" href={`/products/${conversation.product_id}`}>View listing</Link>}
    {result.error?<DataError/>:<Thread id={id} userId={user.id} initial={((result.data??[]) as ChatMessage[]).reverse()}/>}
  </BuyerPage>
}
