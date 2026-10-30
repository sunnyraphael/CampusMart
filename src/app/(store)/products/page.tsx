import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ProductCard, { type ProductCardData } from '@/components/store/ProductCard'
import SortSelect from '@/components/store/SortSelect'
import { PAGE_SIZE, buildProductsHref, cleanSearch, parseSort } from '@/lib/products-query'

// Server component: the database does the filtering, sorting and paging, and the browser
// receives finished HTML. The URL is the single source of truth (?category= &q= &sort= &page=).
type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

const SELECT = `
  id, title, price, images, avg_rating, total_reviews, stock_quantity,
  compare_at_price, sale_ends_at, condition, availability, delivery_days,
  categories ( name, slug ),
  sellers:public_vendors ( store_name, is_verified )
`

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const categorySlug = first(sp.category)?.trim().toLowerCase() || null
  const q = cleanSearch(first(sp.q))
  const sort = parseSort(first(sp.sort))
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1)

  const supabase = await createClient()

  // Real categories from the database drive the filter chips, so the slugs can never drift from what is stored.
  const { data: categoryRows } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name', { ascending: true })
  const categories = (categoryRows ?? []) as { id: string; name: string; slug: string }[]
  const activeCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) ?? null : null
  const unknownCategory = !!categorySlug && !activeCategory

  const from = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('products')
    .select(SELECT, { count: 'exact' })
    .eq('status', 'active')
    .gt('stock_quantity', 0) // out-of-stock listings stay hidden until the vendor restocks (item J)

  if (activeCategory) query = query.eq('category_id', activeCategory.id)
  if (q) query = query.ilike('title', `%${q}%`)

  if (sort === 'price_asc') query = query.order('price', { ascending: true })
  else if (sort === 'price_desc') query = query.order('price', { ascending: false })
  else if (sort === 'top') query = query.order('avg_rating', { ascending: false, nullsFirst: false })
  // created_at is always the tie-breaker so pages never repeat or skip a listing.
  query = query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1)

  const { data, error, count } = await query

  // Asking for a page past the end: send the visitor to page 1 instead of showing an error.
  if (error && page > 1 && error.code === 'PGRST103') {
    redirect(buildProductsHref({ category: activeCategory?.slug, q, sort, page: 1 }))
  }

  const products = (data ?? []) as unknown as ProductCardData[]
  const total = count ?? products.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const heading = activeCategory ? activeCategory.name : q ? 'Search results' : 'All listings'
  const hrefFor = (p: { category?: string | null; page?: number }) =>
    buildProductsHref({ category: p.category, q, sort, page: p.page })

  return (
    <section className="pl" aria-labelledby="pl-title">
      <header className="pl-head">
        <div className="pl-head-text">
          <h1 id="pl-title" className="pl-title">{heading}</h1>
          <p className="pl-count">
            {error
              ? 'Could not load listings'
              : `${total.toLocaleString('en-NG')} ${total === 1 ? 'listing' : 'listings'}`}
            {q && (
              <>
                {' '}for &ldquo;{q}&rdquo;{' '}
                <Link href={hrefFor({ category: activeCategory?.slug })} className="pl-clear">Clear search</Link>
              </>
            )}
          </p>
        </div>
        <SortSelect sort={sort} category={activeCategory?.slug ?? null} q={q} />
      </header>

      <nav className="pl-chips" aria-label="Categories">
        <Link
          href={hrefFor({})}
          className="pl-chip"
          aria-current={!activeCategory ? 'page' : undefined}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={hrefFor({ category: c.slug })}
            className="pl-chip"
            aria-current={activeCategory?.id === c.id ? 'page' : undefined}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {unknownCategory && (
        <p className="pl-note" role="status">
          We could not find a category called &ldquo;{categorySlug}&rdquo;, so you are seeing every listing.
        </p>
      )}

      {error ? (
        // A database problem is shown, never disguised as an empty shop (trim the detail before launch).
        <div className="pl-state is-error" role="alert">
          <AlertTriangle size={28} strokeWidth={1.5} aria-hidden="true" />
          <h2>Listings could not be loaded</h2>
          <p>{error.message}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="pl-state">
          <PackageSearch size={28} strokeWidth={1.5} aria-hidden="true" />
          <h2>No listings match</h2>
          <p>
            {q || activeCategory
              ? 'Nothing is in stock for this search or category right now.'
              : 'There are no listings in stock right now.'}
          </p>
          {(q || activeCategory) && (
            <Link href="/products" className="pl-btn">See all listings</Link>
          )}
        </div>
      ) : (
        <div className="pl-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} showCategory={!activeCategory} />
          ))}
        </div>
      )}

      {!error && totalPages > 1 && (
        <nav className="pl-pager" aria-label="Pagination">
          {page > 1 ? (
            <Link href={hrefFor({ category: activeCategory?.slug, page: page - 1 })} className="pl-btn" rel="prev">
              <ChevronLeft size={16} aria-hidden="true" /> Previous
            </Link>
          ) : (
            <span className="pl-btn is-off" aria-disabled="true"><ChevronLeft size={16} aria-hidden="true" /> Previous</span>
          )}
          <span className="pl-page">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={hrefFor({ category: activeCategory?.slug, page: page + 1 })} className="pl-btn" rel="next">
              Next <ChevronRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <span className="pl-btn is-off" aria-disabled="true">Next <ChevronRight size={16} aria-hidden="true" /></span>
          )}
        </nav>
      )}
    </section>
  )
}