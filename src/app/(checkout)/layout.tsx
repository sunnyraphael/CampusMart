import Link from 'next/link'
export default function CheckoutLayout({children}:{children:React.ReactNode}) {
  return <div className="buyer-site"><header className="checkout-header"><Link href="/">CampusMart</Link><Link href="/cart">Back to cart</Link></header><main className="max-w-screen-lg mx-auto px-4 py-8 md:px-6">{children}<nav className="by-policy-links" aria-label="Checkout policies" style={{marginTop:24}}><Link href="/terms#fees">Fees & terms</Link><Link href="/refunds">Refund policy</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact support</Link></nav></main></div>
}

export const metadata={robots:{index:false,follow:false}}
