export const COOKIE_CHOICE_KEY = 'campusmart-cookie-choice'
export const COOKIE_CHOICE_EVENT = 'campusmart:cookie-choice'
export const COOKIE_PREFERENCES_EVENT = 'campusmart:cookie-preferences'
export const COOKIE_CHOICE_MAX_AGE = 365 * 24 * 60 * 60 * 1000

export type CookieChoice = { version: 1; essential: true; savedAt: string }
export function parseCookieChoice(raw: string | null, now = Date.now()): CookieChoice | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (value?.version !== 1 || value?.essential !== true || typeof value.savedAt !== 'string') return null
    const at = Date.parse(value.savedAt)
    if (!Number.isFinite(at) || at > now + 60_000 || now - at >= COOKIE_CHOICE_MAX_AGE) return null
    return { version: 1, essential: true, savedAt: value.savedAt }
  } catch { return null }
}
export function makeCookieChoice(at: Date): string {
  return JSON.stringify({ version: 1, essential: true, savedAt: at.toISOString() } satisfies CookieChoice)
}
