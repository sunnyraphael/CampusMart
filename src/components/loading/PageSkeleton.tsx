import type { SkeletonKind } from '@/lib/loading-routes'
import { ArticleSkeleton, AuthSkeleton, CartSkeleton, CatalogSkeleton, CategoriesSkeleton, CheckoutSkeleton, ContactSkeleton, HelpSkeleton, HomeSkeleton, InboxSkeleton, NotificationsSkeleton, OrdersSkeleton, ProductSkeleton, ProfileSkeleton, SavedSkeleton, SettingsSkeleton, StorefrontSkeleton, ThreadSkeleton } from './StoreSkeletons'
import { AdminSkeleton, EarningsSkeleton, GuideSkeleton, ListingFormSkeleton, OnboardingSkeleton, PackingSkeleton, VendorListingsSkeleton, VendorOrderSkeleton, VendorOrdersSkeleton, VendorOverviewSkeleton, VendorSettingsSkeleton, VerifySkeleton } from './VendorSkeletons'

export default function PageSkeleton({ kind }: { kind: SkeletonKind }) {
  switch (kind) {
    case 'homepage': return <HomeSkeleton />
    case 'catalog': return <CatalogSkeleton />
    case 'deals': case 'favorites': return <CatalogSkeleton kind={kind} />
    case 'categories': return <CategoriesSkeleton />
    case 'product': return <ProductSkeleton />
    case 'storefront': return <StorefrontSkeleton />
    case 'orders': return <OrdersSkeleton />
    case 'order-detail': return <OrdersSkeleton detail />
    case 'inbox': return <InboxSkeleton />
    case 'thread': return <ThreadSkeleton />
    case 'notifications': return <NotificationsSkeleton />
    case 'saved': return <SavedSkeleton />
    case 'profile': return <ProfileSkeleton />
    case 'settings': return <SettingsSkeleton />
    case 'contact': return <ContactSkeleton />
    case 'help': return <HelpSkeleton />
    case 'article': return <ArticleSkeleton />
    case 'enrollment': return <ArticleSkeleton enrollment />
    case 'cart': return <CartSkeleton />
    case 'checkout': return <CheckoutSkeleton />
    case 'login': case 'register': case 'forgot': case 'reset': return <AuthSkeleton mode={kind} />
    case 'vendor-overview': return <VendorOverviewSkeleton />
    case 'vendor-listings': return <VendorListingsSkeleton />
    case 'listing-form': return <ListingFormSkeleton />
    case 'vendor-orders': return <VendorOrdersSkeleton />
    case 'vendor-order': return <VendorOrderSkeleton />
    case 'packing-slip': return <PackingSkeleton />
    case 'earnings': return <EarningsSkeleton />
    case 'vendor-settings': return <VendorSettingsSkeleton />
    case 'verify': return <VerifySkeleton />
    case 'onboarding': return <OnboardingSkeleton />
    case 'guide': return <GuideSkeleton />
    case 'vendor-inbox': return <InboxSkeleton vendor />
    case 'vendor-thread': return <ThreadSkeleton vendor />
    case 'admin-verifications': return <AdminSkeleton />
    case 'admin-disputes': return <AdminSkeleton kind="disputes" />
    case 'admin-support': return <AdminSkeleton kind="support" />
  }
}
