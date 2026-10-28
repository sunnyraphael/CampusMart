import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ListingForm from '../../ListingForm'

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params // Next.js 16: params is a Promise

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!seller) redirect('/vendor/onboarding')

  // Filtering by seller_id means a vendor can only open their own listing
  const { data: product, error } = await supabase
    .from('products')
    .select(
      'id, title, description, category_id, price, stock_quantity, images, status, compare_at_price, sale_ends_at, condition, availability, delivery_days'
    )
    .eq('id', id)
    .eq('seller_id', seller.id)
    .maybeSingle()

  // A database error is not the same as "no such listing", so show it
  // instead of hiding it behind a 404.
  if (error) {
    return (
      <div className="le-box">
        <style>{`
          .le-box {
            max-width: 560px; margin: 0 auto; padding: 22px;
            background: var(--vs-bg, #0f1a35); border: 1px solid var(--vs-border, #1e3a5f);
            border-radius: 14px; font-family: var(--font-dm-sans);
          }
          .le-title { font-family: var(--font-sora); font-size: 1.1rem; font-weight: 700; color: var(--vs-heading, #fff); margin: 0 0 8px; }
          .le-text { font-size: 0.88rem; line-height: 1.5; color: var(--vs-muted, #8fa3c4); margin: 0 0 12px; }
          .le-code { font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--vs-heading, #fff); overflow-wrap: anywhere; margin: 0 0 16px; }
          .le-link { font-size: 0.88rem; font-weight: 600; color: #2563eb; text-decoration: none; }
          .le-link:hover { text-decoration: underline; }
        `}</style>
        <h1 className="le-title">We couldn&apos;t open this listing</h1>
        <p className="le-text">Something went wrong while loading it. Copy the message below when you ask for help.</p>
        <p className="le-code">
          {error.message}{error.code ? ` (code ${error.code})` : ''}
        </p>
        <Link href="/vendor/listings" className="le-link">Back to listings</Link>
      </div>
    )
  }

  if (!product) notFound()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <ListingForm
      mode="edit"
      sellerId={seller.id}
      categories={categories ?? []}
      initial={product}
    />
  )
}