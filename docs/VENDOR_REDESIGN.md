# Vendor workspace redesign — October 31, 2026

The vendor workspace keeps CampusMart’s blue, navy, light theme, and dark theme. A shared layout and stylesheet now give every vendor route consistent typography, spacing, controls, and surfaces.

## Pages

| Page | What changed |
| --- | --- |
| Overview | Store metrics, a seven-day sales chart in Nigeria time, recent orders, bestsellers, and a setup checklist based on saved store details. The checklist links directly to each task. |
| Listings | Compact management cards with search, active/draft filters, stock filters, and sorting. Published cards link to the public listing. Native confirmation dialogs protect deletion. |
| Create/edit listing | Sections for details, photos, pricing, and stock/delivery; direct section links; two-column desktop layout; persistent save controls. Existing uploads, promotions, drafts, and delivery options remain available. |
| Orders | Order counts, search by reference or product name, stage filters, and clearer fulfilment cards. Status changes reload the saved server state. Failed requests leave controls available for retry. |
| Order details | Order summary, item breakdowns, delivery information, and a packing-slip action. |
| Packing slip | Responsive document preview with a back link and A4 print layout. |
| Earnings | Clear wallet and pending earnings panels, transaction filters, and a CSV download. Wallet funds are distinguished from bank transfers. |
| Settings | Section navigation, a storefront preview link, store-link sharing, and consistent forms for profile, contact, and payout information. |
| Verification | A three-step explanation, document uploads, and status panels for submitted, approved, and rejected applications. |
| Onboarding | The same workspace styling, theme-aware inputs, associated field labels, and native agreement checkboxes accessible by keyboard. |
| Messages (new vendor routes) | Existing private CampusMart conversations and message threads inside the vendor workspace. |
| Vendor guide (new) | Practical guidance about listings, inventory, fulfilment, earnings, verification, and buyer communication. Links lead to the relevant working page. |

## Added features

- **Store sharing:** Share store copies the public storefront URL. If clipboard access is unavailable, an input displays the URL for manual copying.
- **Tasks on the overview:** Shows distinct paid orders to fulfil, active listings with three or fewer units, and saved drafts. Pre-orders are excluded from restock alerts. Each task opens the appropriate page or filter.
- **Real setup progress:** Store profile, payout details, first published listing, and identity approval determine completion. These values replace the earlier hard-coded checklist.
- **Listing discovery controls:** Search matches titles; stock filters exclude pre-orders; sorting supports newest, price, and quantity. Clearing filters restores the catalog.
- **Transaction export:** Downloads records in the current transaction filter from the latest 100 loaded transactions. CSV text is quoted and spreadsheet formulas are neutralized. Export does not initiate a payout.
- **Vendor messaging:** `/vendor/messages` and `/vendor/messages/[id]` use the same authenticated conversation RPCs and row security as `/messages`. Conversations are shared between the two views; no duplicate messages or new chat database are created. The inbox refreshes every 15 seconds while visible and on window focus; an open thread checks for new messages every five seconds.
- **Mobile navigation:** A bottom bar opens overview, listings, new listing, orders, and messages. The menu provides earnings, settings, verification, the guide, and shopping links. Keyboard users can close the menu with Escape.
- **Loading and failure states:** Vendor routes have consistent loading, retry, and unavailable-page views. Database failures no longer silently appear as an empty catalog or an unconfigured store on the updated routes.

## Data and scope

- No new database migration is required for this redesign. Existing CampusMart database tables, RPCs, policies, and the earlier migrations remain prerequisites.
- Sales totals, chart values, and bestseller rankings exclude refunded and cancelled items and use paid orders only. Historical paid-order counts still include refunded orders so the order record is visible.
- Pending earnings use a recorded payout amount when present, otherwise the existing 95% calculation.
- Checkout/payment verification and bank withdrawal processing are separate work. This redesign does not enable payment collection or pretend that a transfer occurred.
- Existing owner-scoped deletion and queued, shared-image-safe cleanup are retained.
- Changes are local and are not committed, pushed, or deployed automatically.

## Verification

Validation uses a local Supabase protocol fixture and isolated PostgreSQL tests. Browser checks do not send real messages, make payments, alter production records, or contact the live Supabase project. See `tests/browser/vendor-design.spec.ts` for the responsive page and interaction coverage and `tests/vendor-overview.test.mjs` for sales aggregation and CSV checks.

Checks: production build, 23 logic/database tests, 28 existing buyer/vendor browser regressions, and 17 vendor redesign browser cases. Narrow-phone verification overflow and mobile menu focus issues found during validation were corrected and rechecked. Vendor lint has no errors; five native image optimization warnings remain.
