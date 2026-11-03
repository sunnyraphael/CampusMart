# November 3 website audit follow-up

Public routes now have route-specific metadata and canonical URLs. Product and vendor metadata share their request-scoped database lookup with the page; no second lookup or shared authenticated cache is added. Search results and private/utility pages are noindex. Public listing filters retain their URLs; login return parameters and temporary authentication redirects remain intentional.

robots.txt advertises a cached public-only sitemap. It uses anonymous RLS-filtered reads, never a service key, and lists up to 1,000 in-stock active products and 1,000 public vendors plus static pages. Split the sitemap into paged files before either public directory exceeds that size. It omits unverified modification dates. Crawling restrictions are not security controls; account access still requires authentication.

Loading placeholders use visual titles rather than document H1s. Tailwind scans src only, excluding test selectors and generated build output. Public logo caching is one day, with revalidation; newly uploaded public WebP item photos already have versioned names and year-long caching. Legacy Supabase image metadata was not modified. Legacy catalogue photos from this project's public product-images path now use next/image and Netlify Image CDN with responsive sizes and CDN-managed caching; arbitrary hosts and private buckets cannot be proxied. Existing sibling WebP thumbnails remain direct. The logo uses the same built-in optimizer. The first homepage mosaic image gets eager/high priority; other thumbnails remain lazy.

The deployed app hides its framework header. Netlify static responses receive nosniff. Framework scripts have request-specific CSP nonces and strict-dynamic; inline event handlers are disabled. Inline styles remain necessary for this interface. The deprecated X-XSS-Protection filter is intentionally not enabled. Authentication forms explicitly declare POST, with actual sign-in still performed by the Supabase SDK over HTTPS in production. No artificial word-count padding or removal of authentication redirects.

Admin sidebar links use full navigations instead of cached route prefetches. Signed-in responses carry explicit private/no-store and Netlify CDN no-store directives. Admin read requests have ten-second deadlines; mutations retain their existing uncertain-result safeguards. Independent finance reads execute in parallel. Read failures show the existing retry/error states. Password and transaction-PIN checks remain authoritative on the server and database. No SQL migration is needed for this update.

The reported Netlify blank-content symptom could not be reproduced with healthy fixture data in the first production-mode run; the hosting-side cause is not proven. Production browser checks cover password unlock, every sidebar tab, PIN operations, read failure/recovery, metadata and CSP. Re-test the affected real account after publication; fixture checks cannot certify its cloud data/configuration. No credentials, real user data or money decisions were used in testing.

## Verification after publication

The deployed public homepage, categories, login, robots and sitemap returned 200. Signed-out admin access still redirects to login. Login password visibility and signup age selection hydrated correctly; the 390px homepage fit without horizontal overflow, with no runtime/CSP errors during the smoke check. A sampled optimized catalogue photo returned 10,284 bytes with a one-hour public cache; raw logo caching was one day, and a sampled JavaScript asset had nosniff and a one-year immutable cache. The optimized logo loaded successfully. No signed-in real admin session was used.

Validation passed: 137 automated tests, the 15-case production audit/payment/admin suite, and the 16-case Google/mobile/audit suite (some audit cases overlap). Production build and type checking passed. Lint reported zero errors and 21 existing warnings.

## Admin blank-panel reproduction and fix

The follow-up screenshot led to a reproducible cosmetic-filter collision: EasyList's maintained easylist_general_hide.txt contains ##.ad-body, and the admin main element used that exact class. Applying .ad-body{display:none!important} reproduced the visible sidebar/header and completely blank content, even with healthy authenticated data. The old production build failed the visibility regression. Renamed the ordinary admin content and wrapper classes to admin-content-area and admin-workspace and updated every dependent selector. The all-tabs production regression now keeps the EasyList rule active on every document navigation. Users do not need to disable ad blockers. The earlier clean-browser checks did not simulate this extension behavior.

Source: https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_general_hide.txt

Validation of the naming fix: the production build passed, and all six targeted browser checks passed, including every admin tab with the EasyList rule active and light/dark mobile/desktop layouts.
