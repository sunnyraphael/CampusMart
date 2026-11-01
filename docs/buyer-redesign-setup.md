# Buyer redesign and privacy controls

Implemented 1 November 2026. These changes keep CampusMart's blue/navy theme and the compact mobile cart icon, with full desktop cart buttons. No live payment or payout integration was added.

## Required database setup

Apply these complete files in Supabase SQL Editor **once, in order**, after the existing October migrations:

1. `supabase/migrations/202611010001_account_controls.sql`
2. `supabase/migrations/202611010002_marketplace_consent.sql`
3. `supabase/migrations/202611010003_review_integrity.sql`

The subsequent mobile-navigation/cancellation update also needs `supabase/migrations/202611010004_buyer_order_cancellation.sql`, applied once after these files. See [the website review](website-review-2026-11-01.md) for its behavior, live-payment limitations and remaining launch findings.

The coding agent has not applied these to the live database. The new controls need these migrations; without them, permissions and account-change screens report that the service is unavailable and new checkout actions fail closed. The three migrations are also tested together in an isolated database.

Existing buyers must review `/consent` before new orders or messages. Existing vendors must also accept vendor terms; their workspace shows a reminder with a review link. A listing's vendor needs current selling permission before a new order item can be created. Existing order fulfilment, receipt, dispute and support actions remain available when guardian permission is withdrawn.

## What changed

| Requested area | Implementation |
| --- | --- |
| Buyer redesign | Homepage, shopping/category/product/store pages, buyer account workspace, orders, messages, profile, settings, cart/checkout, auth and information pages; matching loading layouts |
| Policies | `/privacy`, `/terms`, `/vendor-terms`, `/refunds`, `/cookies`, linked from the relevant screens and footer |
| Cookie choices | Compact non-blocking notice, essential-only storage explanation, saved preferences and a reset control; no optional tracking categories are invented |
| Form consent | Unchecked terms acknowledgement at registration, separate vendor agreement, explicit order-total/terms confirmation, timestamped/versioned server records |
| Age/guardian permission | Age band rather than date of birth; guardian permission reviewed before under-18 registration; separate permission and vendor agreement for selling |
| Data minimisation | Optional profile phone, delivery-only address, explicit product/order query fields, no signup identity-document collection, bank details deferred from store onboarding, reduced error/referrer disclosure |
| Honest presentation | No default five-star review, no fake rating/count placeholders, no persistent “New” promotion badge, vendor reference prices and delivery estimates clearly labelled |
| Review integrity | Existing paid/received-purchase rules retained, self-reviews blocked, averages/counts derived from source reviews and refreshed after edits/removal; no source reviews invented or retroactively certified |
| Fees | Item/service/delivery amounts disclosed before order submission; trial checkout clearly collects no money |
| Account choices | `/settings/account` separates store-only closure, account closure, both, and eligible data-removal requests; requests/history can be reviewed at `/admin/account-requests` |
| SDK audit | Next.js/Zod security updates, unused production generator removed and compatible dependency patches applied; production audit zero findings; 16 moderate development-only advisories remain documented |

## Operating the controls

- **Store only:** closes immediately and unpublishes listings; the buyer account and existing obligations remain. Reopening does not republish drafts automatically.
- **Account or both:** requests reviewed deactivation after outstanding obligations and balances are settled. A “both” request closes the store immediately. Closure retains necessary records and the authentication identity; it does not claim to erase data.
- **Data removal:** a durable request for manual retention assessment and fulfilment. Admin review updates do not falsely mark data erased. The operator must carry out and document eligible removal separately.
- **Guardian permission:** an adult signs in at `/guardian-permission`, submits permission for the student's intended email and optionally authorizes selling. The email is stored as a fingerprint, which remains personal data. Admin reviews `/admin/guardian-permissions`, actually checks identity/authority/permission using an approved process and records a note. The approved reference is shared by the guardian; no notification email sender is configured. See [guardian-consent.md](guardian-consent.md).

## Details intentionally deferred by the owner

The legal business name and public privacy/support email are not ready. Public pages currently use CampusMart and Contact & support. Set `NEXT_PUBLIC_SUPPORT_EMAIL` when a real monitored address is available; do not publish a made-up address.

Before public launch, confirm the legal operator/contact details, applicable retention rules, the secure guardian-verification procedure and payment-provider eligibility for guardian-supervised selling. The software does not certify legal compliance or automatically verify someone's identity. Policies should receive an appropriate legal/business review against actual operations.

New accounts use email registration so the database can require the age/terms declarations. Google sign-in remains for existing accounts; the new-user database trigger rejects a new OAuth account with no declarations.

## Validation

- Production build and TypeScript checks pass. `CAMPUSMART_BUILD_CHECK=1` uses a separate output folder/config so a build check does not delete a running developer server's artifacts.
- 86 logic/database tests pass, including the migrations together, guardian scope/withdrawal, closure access, fee rules, delivery credit safeguards and review integrity.
- Browser coverage includes all buyer routes at 320px/1440px in both themes, auth layouts, cookie persistence/reset, consent gates, closure/request history, admin review, matching catalog loader geometry, offline recovery and full trial delivery.
- Scoped lint reports no errors; existing raw-image performance warnings remain. Audit details and snapshots are in [third-party-audit.md](third-party-audit.md).

Restart the development server after dependency upgrades if an existing process is still using old modules. No deployment, live SQL execution, commit or real transfer/refund was performed.
