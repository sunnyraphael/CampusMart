import { redirect } from 'next/navigation'
import { buildProductsHref } from '@/lib/products-query'
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}) { redirect(buildProductsHref({category:(await params).slug})) }
