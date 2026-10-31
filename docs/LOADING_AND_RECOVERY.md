# Loading and recovery screens

Implemented for CampusMart on October 31, 2026.

## Error screens

- Buyer, vendor, authentication, checkout, and admin routes use a shared CampusMart error design. Root route and root-layout failures have their own boundaries.
- Missing pages and unavailable vendor resources have a branded 404 screen with useful navigation.
- Failed data sections have a smaller version of the same screen, with retry and support actions.
- Server-page recovery uses Next.js 16’s `unstable_retry` so it fetches fresh server content. A reset-only recovery could otherwise replay a failed server result.
- Internal messages and stack traces are logged for debugging; visitors see a support reference when one is available.

## Offline behavior

When the connection drops in an already open tab, the application shows an offline screen without unmounting the page underneath. Existing client form state stays in place. Reconnecting restores that same page; it does not resubmit forms, messages, orders, or payments.

A service worker also provides a branded offline screen for a full navigation or refresh after the site has been visited online and its worker has installed. First-ever visits without any network, disabled service workers, or cleared browser storage can still show the browser’s own offline error.

The worker stores only three public files: `/offline.html`, `/status.css`, and `/offline.js`. Account pages, API responses, Supabase data, messages, identity documents, and authenticated HTML are not cached. Only GET navigation failures use the fallback. POST requests are never queued or replayed.

`/api/connectivity` is a small public, uncached check of whether the CampusMart server can be reached. It does not call Supabase or return account information. The worker files, offline assets, and connectivity check bypass the authentication proxy.

When changing the public offline assets, increment `OFFLINE_CACHE` in `public/sw.js` so previously installed workers replace their copy. Activation removes only obsolete caches with the CampusMart offline prefix.

## Skeletons

All 46 current page routes have explicit `loading.tsx` files. Buyer, vendor, auth, checkout, and admin templates cover:

- Homepage hero, listing tiles, and information sections.
- Catalog/category grids, deals, favorites, product gallery/detail, and public storefronts.
- Account links, profile and password forms, notifications, saved searches, help, contact, and information pages.
- Cart item rows and totals, checkout delivery form and order summary.
- Order lists/details and inboxes/conversations.
- Vendor metrics/chart/checklist, inventory, listing editor, fulfilment, packing slip, wallet/history, settings, verification, onboarding, and guide.
- Admin verification, dispute, and support queues.

Skeletons reuse the same responsive page, card, grid, and form classes as the completed views. Shared styles load from layouts, before route data arrives. Stable headings use masked page copy to preserve their line wrapping. Dynamic titles, conditional fields, images, record counts, and empty results can only be known after data loads, so placeholder content is representative rather than fabricated data.

Cart and checkout use these same templates while browser storage hydrates. No artificial delay is added to make a skeleton visible: fast pages show their real content immediately. Loading regions announce their state and are non-interactive; animation is disabled for reduced-motion preferences.

## Checks

The tests use local fixtures, not production accounts. Coverage includes loader files on every page, offline draft preservation, offline refresh and cache contents, error retries, 404s, responsive card geometry, and distinct vendor loading layouts. Existing buyer/vendor navigation and interaction checks also run against the shared-style changes.
