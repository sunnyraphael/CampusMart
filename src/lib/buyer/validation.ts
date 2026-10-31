import { z } from 'zod'

export const uuid = z.uuid()
export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name.').max(100),
  phone: z.string().trim().refine((v) => !v || /^(\+234|0)\d{10}$/.test(v), 'Use a Nigerian number such as 08012345678.'),
})
export const passwordSchema = z.string().min(8, 'Use at least 8 characters.').max(128)
export const messageSchema = z.string().trim().min(1, 'Write a message first.').max(2000, 'Messages can be up to 2,000 characters.')
export const supportSchema = z.object({
  subject: z.string().trim().min(5, 'Add a short subject.').max(120),
  body: z.string().trim().min(20, 'Please include at least 20 characters of detail.').max(4000),
  order_id: z.union([uuid, z.literal('')]).optional(),
})

// Never accept an origin, a protocol-relative path, or a backslash from a redirect parameter.
export function safeRedirect(value: string | null | undefined, fallback = '/', allowAuthPage = false): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return fallback
  try {
    const url = new URL(value, 'https://campusmart.invalid')
    return url.origin === 'https://campusmart.invalid' && (allowAuthPage || !['/login','/register','/auth/callback'].includes(url.pathname)) ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch { return fallback }
}

export function localRedirectUrl(origin: string, destination: string): URL {
  // Internal guards must be able to send signed-out visitors to login. User-
  // supplied post-login destinations still use safeRedirect's default loop guard.
  return new URL(safeRedirect(destination, '/', true), new URL(origin).origin)
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
