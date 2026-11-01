import { AccountControlsSkeleton,ConsentSkeleton,GuardianPermissionSkeleton,AdminAccountRequestsSkeleton,AdminGuardianSkeleton } from './PrivacySkeletons'
import PolicySkeleton from '@/components/privacy/PolicySkeleton'
import SettingsSkeleton from '@/components/account/SettingsSkeleton'
import { ShoppingHomeSkeleton,ShoppingCatalogSkeleton,ShoppingCategoriesSkeleton,ShoppingProductSkeleton,ShoppingStorefrontSkeleton } from './ShoppingSkeletons'
import { AdminOverviewSkeleton, AdminQueueSkeleton } from './AdminSkeletons'
import type { SkeletonKind } from '@/lib/loading-routes'
import { ArticleSkeleton, AuthSkeleton, CartSkeleton, CheckoutSkeleton, ContactSkeleton, HelpSkeleton, InboxSkeleton, NotificationsSkeleton, OrdersSkeleton, ProfileSkeleton, SavedSkeleton, ThreadSkeleton } from './StoreSkeletons'
import { EarningsSkeleton, GuideSkeleton, ListingFormSkeleton, OnboardingSkeleton, PackingSkeleton, VendorListingsSkeleton, VendorOrderSkeleton, VendorOrdersSkeleton, VendorOverviewSkeleton, VendorSettingsSkeleton, VerifySkeleton } from './VendorSkeletons'

export default function PageSkeleton({ kind }: { kind: SkeletonKind }) {
  switch (kind) {
    case 'homepage': return <ShoppingHomeSkeleton />
    case 'catalog': return <ShoppingCatalogSkeleton kind="catalog" />
    case 'deals': case 'favorites': return <ShoppingCatalogSkeleton kind={kind} />
    case 'categories': return <ShoppingCategoriesSkeleton />
    case 'product': return <ShoppingProductSkeleton />
    case 'storefront': return <ShoppingStorefrontSkeleton />
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
    case 'policy': return <PolicySkeleton />
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
    case 'account-controls': return <AccountControlsSkeleton />
    case 'consent': return <ConsentSkeleton />
    case 'guardian-permission': return <GuardianPermissionSkeleton />
    case 'admin-account-requests': return <AdminAccountRequestsSkeleton />
    case 'admin-guardian-permissions': return <AdminGuardianSkeleton />
    case 'admin-overview': return <AdminOverviewSkeleton />
    case 'admin-verifications': return <AdminQueueSkeleton kind="verifications" />
    case 'admin-disputes': return <AdminQueueSkeleton kind="disputes" />
    case 'admin-deliveries': return <AdminQueueSkeleton kind="deliveries" />
    case 'admin-support': return <AdminQueueSkeleton kind="support" />
  }
}
