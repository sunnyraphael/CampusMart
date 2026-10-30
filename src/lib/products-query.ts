// Shared rules for the products list URL: which sort keys exist, how a URL is built,
// and how a typed search is cleaned. Pure functions, so the server page and the
// client sort dropdown can never disagree.

export const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'top', label: 'Top rated' },
] as const

export type SortKey = (typeof SORT_OPTIONS)[number]['key']

export const PAGE_SIZE = 24

export function parseSort(value: string | undefined): SortKey {
  return SORT_OPTIONS.some((o) => o.key === value) ? (value as SortKey) : 'newest'
}

// Keeps the search short and removes characters that mean something to the database pattern matcher.
export function cleanSearch(value: string | undefined): string | null {
  if (!value) return null
  const cleaned = value.replace(/[%_\\,()*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return cleaned || null
}

// Only non-default values go into the URL, so the plain list stays at /products.
export function buildProductsHref(params: {
  category?: string | null
  q?: string | null
  sort?: SortKey
  page?: number
}): string {
  const sp = new URLSearchParams()
  if (params.category) sp.set('category', params.category)
  if (params.q) sp.set('q', params.q)
  if (params.sort && params.sort !== 'newest') sp.set('sort', params.sort)
  if (params.page && params.page > 1) sp.set('page', String(params.page))
  const qs = sp.toString()
  return qs ? `/products?${qs}` : '/products'
}