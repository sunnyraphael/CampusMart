import Link from 'next/link'
export default function CheckoutLayout({children}:{children:React.ReactNode}) {
  return <div><header className="checkout-header"><Link href="/">CampusMart</Link><Link href="/cart">Back to cart</Link></header><main className="max-w-screen-lg mx-auto px-4 py-8 md:px-6">{children}</main></div>
}
