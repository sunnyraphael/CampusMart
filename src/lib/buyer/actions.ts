'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { messageSchema, profileSchema, supportSchema, uuid } from './validation'
import { z } from 'zod'

async function session() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Please log in to continue.')
  return { supabase, user }
}

function fail(error: unknown): { error: string } {
  console.error('Buyer action failed', error)
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? 'Please check the form.' }
  if (error instanceof Error && error.message === 'Please log in to continue.') return { error: error.message }
  return { error: 'We could not save that change. Please try again or contact support.' }
}

export async function setFavorite(productId: string, saved: boolean) {
  try {
    uuid.parse(productId)
    z.boolean().parse(saved)
    const { supabase } = await session()
    const { error } = await supabase.rpc('cm_set_favorite', { p_product_id: productId, p_saved: saved })
    if (error) throw error
    revalidatePath('/wishlist')
    return { ok: true }
  } catch (error) { return fail(error) }
}

export async function updateProfile(input: unknown) {
  try {
    const values = profileSchema.parse(input)
    const { supabase } = await session()
    const { error } = await supabase.rpc('cm_update_profile', { p_full_name: values.full_name, p_phone: values.phone })
    if (error) throw error
    revalidatePath('/profile')
    return { ok: true }
  } catch (error) { return fail(error) }
}

export async function markNotificationsRead(id?: string) {
  try {
    if (id) uuid.parse(id)
    const { supabase } = await session()
    const { error } = await supabase.rpc('cm_read_notifications', { p_id: id ?? null })
    if (error) throw error
    revalidatePath('/notifications')
    return { ok: true }
  } catch (error) { return fail(error) }
}

export async function saveSearch(input: unknown) {
  try {
    const values = z.object({ name: z.string().trim().min(1).max(100), query: z.string().max(80), category: z.string().max(100), sort: z.enum(['newest', 'price_asc', 'price_desc', 'top']) }).parse(input)
    const { supabase, user } = await session()
    const { error } = await supabase.from('saved_searches').insert({ ...values, user_id: user.id })
    if (error?.code === '23505') return { ok: true }
    if (error) throw error
    revalidatePath('/saved')
    return { ok: true }
  } catch (error) { return fail(error) }
}

export async function removeSavedSearch(id: string) {
  try {
    uuid.parse(id)
    const { supabase, user } = await session()
    const { error } = await supabase.from('saved_searches').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    revalidatePath('/saved')
    return { ok: true }
  } catch (error) { return fail(error) }
}

export async function startConversation(vendorId: string, productId?: string) {
  try {
    uuid.parse(vendorId)
    if (productId) uuid.parse(productId)
    const { supabase } = await session()
    const { data, error } = await supabase.rpc('cm_start_conversation', { p_vendor_id: vendorId, p_product_id: productId ?? null })
    if (error) throw error
    if (typeof data !== 'string') throw new Error('No conversation returned')
    revalidatePath('/messages')
    return { id: data }
  } catch (error) { return fail(error) }
}

export async function sendMessage(id: string, body: string) {
  try {
    uuid.parse(id)
    const text = messageSchema.parse(body)
    const { supabase } = await session()
    const { error } = await supabase.rpc('cm_send_message', { p_conversation_id: id, p_body: text })
    if (error) throw error
    revalidatePath('/messages')
    return { ok: true }
  } catch (error) { return fail(error) }
}

export async function submitSupport(input: unknown) {
  try {
    const values = supportSchema.parse(input)
    const { supabase } = await session()
    const { data, error } = await supabase.rpc('cm_support_request', { p_subject: values.subject, p_body: values.body, p_order_id: values.order_id || null })
    if (error) throw error
    revalidatePath('/contact')
    return { id: data as string }
  } catch (error) { return fail(error) }
}

export async function reviewProduct(productId: string, rating: number, comment: string) {
  try {
    uuid.parse(productId)
    z.number().int().min(1).max(5).parse(rating)
    z.string().max(2000).parse(comment)
    const { supabase } = await session()
    const { error } = await supabase.rpc('cm_review_product', { p_product_id:productId, p_rating:rating, p_comment:comment.trim() })
    if(error) throw error
    revalidatePath(`/products/${productId}`)
    return {ok:true}
  } catch(error) {return fail(error)}
}
