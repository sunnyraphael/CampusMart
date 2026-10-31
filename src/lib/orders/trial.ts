import { z } from 'zod'

export function trialCheckoutEnabled(env: { NODE_ENV?: string; CAMPUSMART_TRIAL_CHECKOUT?: string }) {
  return env.CAMPUSMART_TRIAL_CHECKOUT !== '0' && (env.NODE_ENV === 'development' || env.CAMPUSMART_TRIAL_CHECKOUT === '1')
}
const checkoutFields = z.object({
  items: z.array(z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(50)
    .refine(items => new Set(items.map(i => i.product_id)).size === items.length, 'Combine duplicate products in your cart.'),
  deliveryMethod: z.enum(['pickup', 'delivery']),
  address: z.string().trim().max(500),
  phone: z.string().trim().regex(/^(\+234|0)\d{10}$/, 'Use a Nigerian contact number such as 08012345678.'),
  note: z.string().trim().max(1000),
  expectedTotal: z.number().finite().min(0).max(1000000000),
})
const validAddress = (v: { deliveryMethod: string; address: string }) => v.deliveryMethod !== 'delivery' || v.address.length >= 5
const addressError = { message: 'Enter a delivery address of at least 5 characters.', path: ['address'] }
export const trialCheckoutSchema = checkoutFields.refine(validAddress, addressError)
export const trialOrderSchema = checkoutFields.extend({ requestId: z.uuid() }).refine(validAddress, addressError)
