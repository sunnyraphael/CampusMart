'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { trialCheckoutEnabled, trialOrderSchema } from '@/lib/orders/trial'

export async function placeTrialOrder(input: unknown): Promise<{ error: string } | { id: string; total: number }> {
  if (!trialCheckoutEnabled(process.env)) return { error: 'Trial checkout is switched off. You have not been charged.' }
  if(typeof input!=='object'||input===null||!('orderTermsAccepted'in input)||input.orderTermsAccepted!==true)return {error:'Review the total and accept the order terms before placing an order.'}
  const parsed = trialOrderSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check your order details.' }
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Please sign in again before placing your trial order.' }
    const available=await supabase.rpc('cm_checkout_available')
    if(available.error||available.data!==true)return {error:'Ordering is temporarily unavailable. Your cart is saved; please try again later.'}
    const permission=await supabase.rpc('cm_consent_status')
    if(permission.error||permission.data?.eligible!==true)return {error:'Review your account permissions before placing an order. Open Account permissions from Settings.'}
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!key || !url) return { error: 'Trial checkout setup is incomplete. Please contact the site administrator.' }
    const service = createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    const v = parsed.data
    const { data, error, status } = await service.rpc('cm_create_trial_order', { p_user_id: user.id, p_request_id: v.requestId,
      p_items: v.items, p_delivery_method: v.deliveryMethod, p_address: v.address, p_phone: v.phone, p_note: v.note, p_expected_total: v.expectedTotal })
    if (error) {
      if (error.code === 'P0001') return { error: error.message }
      // A single JSON string survives Next's development log serialization.
      // Do not log details: a constraint failure can include a complete customer row.
      console.error(`Trial checkout failed ${JSON.stringify({ status, code: error.code,
        message: error.message.replaceAll(key, '[redacted]').slice(0, 500) })}`)
      if (error.code === '23514') return { error: 'The database rejected this trial order because of a checkout validation rule (23514). No payment was collected. Please ask the site administrator to check the trial checkout setup.' }
      return { error: 'The trial order result could not be confirmed. Retry this checkout to check its result, or open My orders. If this continues, ask the site administrator to check setup.' }
    }
    if (!data?.id || data.is_trial !== true || !Number.isFinite(Number(data.total_amount))) return { error: 'The order response could not be confirmed. Retry this checkout to check its result.' }
    revalidatePath('/orders')
    revalidatePath('/vendor/orders')
    revalidatePath('/notifications')
    return { id: data.id, total: Number(data.total_amount) }
  } catch { return { error: 'The connection was interrupted. Retry this checkout to check whether the trial order was created.' } }
}
