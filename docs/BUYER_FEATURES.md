# Buyer feature implementation - 31 October 2026

## What was built

- Categories: database-backed category links and the compact mobile tiles approved in chat.
- Listings: working header search, saved searches, favorite controls, stock-aware add-to-cart and stable ordering.
- Deals: active, in-stock promotions with paging and an honest empty state.
- Favorites: account-backed saved listings, current prices, removal and handling for unavailable listings.
- Saved searches: save the query, category and sort order, then reopen or remove it later. This does not send alerts.
- Notifications: real unread counts, unread filtering, mark-read actions and links to the matching order.
- Profile: editable full name and Nigerian phone number. Email is read-only.
- Settings: device theme preference, verified-current-password changes, sign-out and privacy/support links.
- Authentication: destination-preserving login, registration role choice, email confirmation callback and password recovery. No administrative role can be supplied at signup.
- Messages: buyer/vendor conversations, private message history, earlier-message loading, unread tracking, validated sends and a server-enforced send rate limit. An open conversation polls every five seconds; the inbox refreshes every fifteen seconds. No Supabase Realtime publication setup is required. This version supports text, not attachments.
- Product details: preserved gallery and delivery/condition/promotion details, favorites, vendor messaging, stock-limited quantity selection and reviews restricted to received, paid purchases.
- Vendor storefront: only public vendor fields, active in-stock listings, paging and a message button.
- Orders: paged purchase history, an individual order page, historical prices, item fulfillment and payment states shown separately, existing receipt/dispute actions and review links.
- Help: searchable answers about accounts, listings, orders and delivery.
- Contact: validated support requests with an optional owned order, request history and administrator replies. A corresponding Support queue was added to the existing admin area.
- Information pages: how buying works, factual data/privacy information and marketplace guidelines. The guidelines are not a substitute for an owner-approved legal terms document.
- Shared loading, query-error and missing-page handling. Database errors are not represented as missing products.

## Required Supabase setup

Apply `supabase/migrations/202610310001_buyer_features.sql` to the EXISTING CampusMart database before using the new account-backed features. The user confirmed on 31 October 2026 that this migration was applied successfully to Supabase.

It requires the pre-existing users, sellers, products, orders, order_items, wishlist, notifications and reviews tables, including the fulfillment/payment columns added in earlier sessions, plus `public.is_admin()`.

The migration adds saved_searches, support_requests, buyer_conversations and buyer_messages and narrow authenticated RPCs. Private rows are restricted to their owners or conversation participants. Administrator access to support requests uses the existing is_admin check. Reviews require a received item on a paid order; direct review writes are revoked so that the aggregate rating is updated together with the review.

The SQL is a versioned one-time migration, wrapped in a transaction. Apply it once through your normal migration process or Supabase SQL Editor after reviewing it. It is additive to the existing schema, not a recreation of the remote database. The source for older remote migrations is still missing and should be brought into version control separately.

In Supabase Auth URL Configuration, allow your real application URL followed by `/auth/callback` for email/OAuth and password recovery. Google sign-in must be enabled in Supabase separately. The callback accepts code exchanges and supported token-hash confirmation links.

For support, verify the address in src/config/site.ts and have administrators use `/admin/support` to reply.

## Payment boundary

The legacy checkout called create_order and then claimed payment had succeeded. Earlier project notes state that the existing RPC can mark simulated orders paid. The new checkout DOES NOT call it, does not clear the cart, and does not claim a charge occurred.

Checkout now refreshes stock and prices and displays a delivery/fee preview. Online payment remains explicitly unavailable. Connecting Paystack requires server-side initialization, server-derived totals and delivery fees, unpaid-order creation, verified webhooks, idempotency and payment reconciliation. This remains a launch blocker. No simulated payment is presented as real.

Orders retain purchase prices; current listing prices are not substituted into historical receipts. Confirmation and dispute actions are available only for paid orders in eligible fulfillment states.

## Verification

- `npm test`: validation/redirect/fee/image tests and real PostgreSQL semantics using an isolated in-memory PGlite instance. The database suite executes the migration and checks privacy, permissions, read markers, favorites, profile role restrictions, support ownership and verified-purchase reviews.
- `npm run lint:buyer`: ESLint for buyer, authentication, checkout and the shared components used in those sections. The general lint command also covers legacy vendor files outside this work.
- `npm run test:e2e`: Chrome/Playwright checks against a LOCAL Supabase protocol fixture. It checks buyer routes, phone/desktop layout, both themes, cart controls, search, favorites, saved searches, messages, support, error rendering and login redirects. These checks do not prove that the live project has been migrated or that external email/OAuth works.
- `npm run build`: production compilation and Next.js route/type checks. The existing next/font setup needs access to Google Fonts during a clean build.

Browser fixtures run on 127.0.0.1:54329 and the app on 127.0.0.1:3101. CAMPUSMART_E2E=1 uses .next-e2e to avoid the normal development server. This flag is set only by tests/start-app.mjs. Browser output is ignored by Git. Test fixtures contain no live credentials.

## Remaining work beyond this buyer implementation

- The first buyer migration is confirmed applied. Regenerate the real Supabase types and test with distinct live buyer/vendor/admin accounts.
- Verify production email confirmation, password recovery redirect allowlists and Google provider configuration.
- Implement and test real payments before launch. Do not remove the checkout gate just to make the button work.
- Owner review of support contact details, marketplace terms, retention rules and privacy disclosures before publication.
- Existing future roadmap: cancellations/refunds, overdue delivery handling, report moderation, store pause/deletion, and featured listings.

## References consulted

- Installed Next.js 16.2.7 guides under node_modules/next/dist/docs (pages, routes, actions, errors, proxy, distDir).
- Supabase password recovery: https://supabase.com/docs/guides/auth/passwords
- Supabase database functions: https://supabase.com/docs/guides/database/functions
- Supabase row level security: https://supabase.com/docs/guides/database/postgres/row-level-security

## Completed verification for this change

- Production build: passed, including route generation and TypeScript checks.
- TypeScript without emitting files: passed.
- Buyer ESLint: zero errors; six image optimization warnings remain for ordinary image elements.
- Logic and database suite: 13 tests passed.
- Browser suite: 21 tests passed. All 20 sampled buyer destinations loaded without client exceptions. Layout cases passed at 320, 360, 390, 412, 430, 600, 900 and 1280 pixels in light and dark themes. Workflow cases covered search, favorites, saved searches, chat, support, cart/checkout safety, error states and destination-preserving login.
- Mobile screenshots of Categories and Listings were inspected in light/dark mode.
- No live Supabase migrations or real payment/email/OAuth transactions were performed.

Restart the local development server after this update so Next.js picks up the middleware-to-proxy convention change cleanly.

## Follow-up fixes

See [the six targeted fixes](BUG_FIXES_2026-10-31.md). They add a separate 202610310002 migration for vendor enrollment and image cleanup. The first migration does not need to be rerun.
