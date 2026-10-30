'use client'

import { useRouter } from 'next/navigation'
import { buildProductsHref, SORT_OPTIONS, type SortKey } from '@/lib/products-query'

// A native select that changes the URL. The server page then re-runs the query with the new sort,
// so the sort order lives in the address bar and survives refresh, back button and sharing.
export default function SortSelect({
  sort,
  category,
  q,
}: {
  sort: SortKey
  category: string | null
  q: string | null
}) {
  const router = useRouter()
  return (
    <div className="pl-sort">
      <label htmlFor="pl-sort">Sort by</label>
      <select
        id="pl-sort"
        value={sort}
        onChange={(e) =>
          router.push(buildProductsHref({ category, q, sort: e.target.value as SortKey, page: 1 }))
        }
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}