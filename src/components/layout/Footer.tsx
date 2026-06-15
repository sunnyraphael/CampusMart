import Link from "next/link"
import { siteConfig } from "@/config/site"

export function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">

          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg">
                <span className="text-sm font-bold text-white">C</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {siteConfig.name}
              </span>
            </div>
            <p className="text-sm text-gray-500 max-w-xs">
              The #1 marketplace for Nigerian university students. Buy and sell anything on campus.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Shop</h3>
            <ul className="space-y-3">
              {["All Products", "Electronics", "Books", "Food", "Fashion"].map((item) => (
                <li key={item}>
                  <Link href="/products" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Sell</h3>
            <ul className="space-y-3">
              {[
                { label: "Start Selling", href: "/vendor/onboarding" },
                { label: "Seller Dashboard", href: "/vendor/dashboard" },
                { label: "How it works", href: "/how-it-works" },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Support</h3>
            <ul className="space-y-3">
              {[
                { label: "Help Center", href: "/help" },
                { label: "Contact Us", href: "/contact" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p className="text-sm text-gray-500">
            Developed by Sunny Raphael Inc.
          </p>
        </div>
      </div>
    </footer>
  )
}