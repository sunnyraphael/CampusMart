import { Search } from 'lucide-react'

export default function SearchForm() {
  return <form action="/products" method="get" role="search" className="site-search"><input type="search" name="q" maxLength={80} placeholder="Search listings…" aria-label="Search listings"/><button type="submit" aria-label="Search"><Search size={18} aria-hidden="true"/></button></form>
}
