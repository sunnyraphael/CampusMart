import Link from 'next/link'
import { Armchair, ArrowUpRight, BookOpen, Dumbbell, Grid2X2, Laptop, PenLine, Shirt, ShoppingBag, Sparkles, Smartphone, Utensils, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { buildProductsHref } from '@/lib/products-query'

// Match both names and slugs so compound database slugs retain their category icon.
const categoryStyles = [
  { match: /book|note/, icon: BookOpen, description: 'Textbooks, notes & reading' },
  { match: /phone|mobile/, icon: Smartphone, description: 'Phones & everyday extras' },
  { match: /electronic|gadget|computer/, icon: Laptop, description: 'Tech for study & everyday life' },
  { match: /furniture|hostel|room/, icon: Armchair, description: 'Make your space your own' },
  { match: /cloth|fashion/, icon: Shirt, description: 'Find your everyday style' },
  { match: /accessor/, icon: ShoppingBag, description: 'The little finishing touches' },
  { match: /sport|fitness/, icon: Dumbbell, description: 'Stay active on campus' },
  { match: /beauty|health|groom/, icon: Sparkles, description: 'Your daily care essentials' },
  { match: /stationery/, icon: PenLine, description: 'Supplies for your next class' },
  { match: /food|drink/, icon: Utensils, description: 'Meals, snacks & refreshments' },
  { match: /service/, icon: Wrench, description: 'Help from campus vendors' },
]

function categoryStyle(slug: string, name: string) {
  return categoryStyles.find(({ match }) => match.test(`${slug} ${name}`.toLowerCase()))
    ?? { icon: Grid2X2, description: 'Explore listings on campus' }
}

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name', { ascending: true })

  return (
    <section className="cat-page" aria-labelledby="categories-title">
      <header className="cat-head">
        <div>
          <h1 id="categories-title">Shop by category</h1>
          <p>From lecture essentials to everyday finds.</p>
        </div>
        <Link href="/products" className="pl-btn">All listings <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>
      {error ? (
        <div className="pl-state is-error" role="alert">
          <h2>Could not load categories</h2>
          <p>Please try again in a moment.</p>
          <Link href="/categories" className="pl-btn">Try again</Link>
        </div>
      ) : data?.length ? (
        <nav className="cat-grid" aria-label="Product categories">
          {data.map((category) => {
            const { icon: Icon, description } = categoryStyle(category.slug, category.name)
            return (
              <Link key={category.id} href={buildProductsHref({ category: category.slug })} className="cat-tile lift">
                <span className="cat-tile-top">
                  <span className="cat-icon"><Icon size={20} strokeWidth={1.75} aria-hidden="true" /></span>
                  <ArrowUpRight size={16} className="cat-arrow" aria-hidden="true" />
                </span>
                <span className="cat-copy">
                  <span className="cat-name">{category.name}</span>
                  <span className="cat-description">{description}</span>
                </span>
              </Link>
            )
          })}
        </nav>
      ) : (
        <div className="pl-state">
          <h2>No categories yet</h2>
          <p>You can still browse all available listings.</p>
        </div>
      )}
    </section>
  )
}
