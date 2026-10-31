export function vendorPageTitle(pathname: string): string {
  if (pathname === '/vendor/guide') return 'Vendor guide'
  if (pathname === '/vendor/messages') return 'Messages'
  if (pathname.startsWith('/vendor/messages/')) return 'Conversation'
  if (pathname === '/vendor/onboarding') return 'Set up your store'
  if (pathname === '/vendor/verify') return 'Verify identity'
  if (pathname === '/vendor/listings/new') return 'New listing'
  if (/^\/vendor\/listings\/[^/]+\/edit$/.test(pathname)) return 'Edit listing'
  if (/^\/vendor\/orders\/[^/]+\/slip$/.test(pathname)) return 'Packing slip'
  if (/^\/vendor\/orders\/[^/]+$/.test(pathname)) return 'Order details'
  const titles: Record<string,string> = {'/vendor/dashboard':'Overview','/vendor/listings':'Listings','/vendor/orders':'Orders','/vendor/earnings':'Earnings','/vendor/settings':'Store settings'}
  return titles[pathname] ?? 'Vendor dashboard'
}
