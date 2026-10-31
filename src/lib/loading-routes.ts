export const loadingRoutes = {
  '/': 'homepage', '/products': 'catalog', '/categories': 'categories', '/deals': 'deals', '/wishlist': 'favorites',
  '/orders': 'orders', '/messages': 'inbox', '/notifications': 'notifications', '/saved': 'saved', '/profile': 'profile', '/settings': 'settings',
  '/contact': 'contact', '/help': 'help', '/privacy': 'article', '/terms': 'article', '/how-it-works': 'article', '/start-selling': 'enrollment',
  '/cart': 'cart', '/checkout': 'checkout', '/login': 'login', '/register': 'register', '/forgot-password': 'forgot', '/reset-password': 'reset',
  '/vendor/dashboard': 'vendor-overview', '/vendor/listings': 'vendor-listings', '/vendor/listings/new': 'listing-form', '/vendor/orders': 'vendor-orders',
  '/vendor/earnings': 'earnings', '/vendor/settings': 'vendor-settings', '/vendor/verify': 'verify', '/vendor/onboarding': 'onboarding', '/vendor/guide': 'guide', '/vendor/messages': 'vendor-inbox',
  '/admin': 'admin-verifications', '/admin/verifications': 'admin-verifications', '/admin/disputes': 'admin-disputes', '/admin/support': 'admin-support',
} as const
export type SkeletonKind = typeof loadingRoutes[keyof typeof loadingRoutes] | 'product' | 'storefront' | 'order-detail' | 'thread' | 'vendor-order' | 'vendor-thread' | 'packing-slip'

export function loadingVariant(path: string): SkeletonKind {
  const pathname = path.split('?')[0].replace(/\/$/, '') || '/'
  if (pathname in loadingRoutes) return loadingRoutes[pathname as keyof typeof loadingRoutes]
  if (/^\/products\/[^/]+$/.test(pathname)) return 'product'
  if (/^\/categories\/[^/]+$/.test(pathname)) return 'catalog'
  if (/^\/vendors\/[^/]+$/.test(pathname)) return 'storefront'
  if (/^\/orders\/[^/]+$/.test(pathname)) return 'order-detail'
  if (/^\/messages\/[^/]+$/.test(pathname)) return 'thread'
  if (/^\/vendor\/listings\/[^/]+\/edit$/.test(pathname)) return 'listing-form'
  if (/^\/vendor\/orders\/[^/]+\/slip$/.test(pathname)) return 'packing-slip'
  if (/^\/vendor\/orders\/[^/]+$/.test(pathname)) return 'vendor-order'
  if (/^\/vendor\/messages\/[^/]+$/.test(pathname)) return 'vendor-thread'
  return 'homepage'
}
