export function listingImages(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && /^(https?:\/\/|\/)/.test(item)).slice(0,8)
  if (typeof value !== 'string') return []
  try { return listingImages(JSON.parse(value)) } catch { return /^(https?:\/\/|\/)/.test(value) ? [value] : [] }
}
