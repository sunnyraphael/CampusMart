# CampusMart third-party SDK and privacy audit

Reviewed: 1 November 2026. Scope: application source, declared production packages, browser storage and the policy/consent components added in this change. This is a code inventory and implementation review; it is not a certification of legal compliance or an inspection of live provider dashboards.

## Providers and application code

| Integration | Observed use | Information or access involved | Current control |
| --- | --- | --- | --- |
| `@supabase/ssr` and `@supabase/supabase-js` | Account authentication, database calls, realtime messages/listings and file storage | Authentication credentials/session tokens; profile, order, chat, support, vendor and verification data according to each feature | Cookie-based SSR sign-in; server user checks and database RLS/RPC authorization. Session cookies are essential to an explicitly requested account feature. Private verification photos use temporary signed URLs. |
| Google OAuth through Supabase | Runs when a person chooses Google sign-in | Provider login, identity/profile fields returned by the configured OAuth provider | No embedded Google login/advertising script found. Google sign-in is a user-initiated external flow. Provider scopes and project configuration still need dashboard review. |
| `next/font/google` | Sora and DM Sans imported by the root layout | Build-time font downloads; browser receives generated local font assets | Next self-hosts the files. The font import is not a browser Google Analytics or advertising integration. |
| Remote listing/store images | Listing galleries, product cards and store images can contain HTTP(S) URLs, including legacy external hosts | An external image host can receive an IP address and request metadata when an image loads | URL handling excludes script schemes. Image-host allowlisting or a controlled image proxy remains a deployment improvement. A no-referrer policy reduces referrer leakage but cannot prevent disclosure of an IP address to an image host. |
| Courier tracking links | A vendor can provide a tracking URL | The courier receives a visitor request if the link is opened | External-provider behavior is separate from CampusMart cookie choices. Keep URLs validated and use safe external-link attributes. |
| Paystack | Server-only HTTPS APIs plus hosted checkout redirect; no embedded browser payment SDK | Checkout shares payer email, amount, currency and order reference. Bank resolution sends bank/account number; private recipient records retain name, bank, last four and provider reference. | Exact charge verification, signed webhooks, durable refund/transfer jobs, admin approval and test/live separation. Card secrets and bank OTPs stay with Paystack. Setup and operator limitations: [paystack-setup.md](paystack-setup.md). |
| Cloudflare Turnstile (optional) | Authentication challenge, enabled only with configured site key and Supabase Auth CAPTCHA settings | Browser/network security signals and short-lived verification token | Interaction-only widget on requested auth forms; token validated by Supabase. No application marketing tracker is added. |
| WhatsApp | Placeholder module only | No active messaging provider calls found | Do not describe WhatsApp notices as an implemented feature. |
| React, Zustand, Lucide, Sonner, Radix/Base UI and animation/chart libraries | User-interface and in-browser state dependencies | Application memory; Zustand cart persistence noted below | No advertising or analytics network calls found from their application integrations. Installed packages alone are not evidence that a tracking service runs. |

No Google Analytics, Meta Pixel, advertising SDK, session replay integration, PostHog, Mixpanel, Clarity or Sentry integration was found in application code. Consequently the cookie interface does not invent optional analytics or advertising switches. Any future optional integration must remain off until the relevant informed choice is recorded; update the provider inventory and request a new choice before activation.

## Device storage inventory

| Storage | Purpose | Contents and lifetime |
| --- | --- | --- |
| Supabase `sb-*` cookies | Sign-in, session refresh and requested authentication flows | Access/refresh credentials and flow state; names and lifetime depend on project/auth configuration. Do not copy these values into logs or screenshots. |
| `campusmart-cart` in local storage | Remember items deliberately added to the cart | Product identity, title, displayed price, quantity, image and vendor name. Persists until cleared or removed by the browser. No order address, phone or card details. |
| `campusmart-theme` in local storage | Appearance chosen by the visitor | Light, dark or system. Persists until changed or cleared. |
| `campusmart-fee-notice-dismissed-v1` and `campusmart-checkout-intro-v1:<account ID>` in local storage | Remember fee-notice dismissal and the first checkout introduction | Boolean choices. The checkout key includes the buyer account identifier to separate accounts on the same browser. Persist until site data is cleared; no address, phone or payment details. |
| `campusmart-cookie-choice` in local storage | Remember that the privacy notice has been acknowledged | Version, `essential: true` and saved date. Expires in application logic after 365 days. No IP, user-agent string, account identifier or tracking identifier is added. |
| `campusmart-trial-checkout` in session storage | Retry a trial request without duplicating an order | Random request identifier and digest. Removed after a confirmed result or when the tab session ends; does not store the source address/phone text. |
| `campusmart-payment-checkout` / `campusmart-payment-cart` in session storage | Stable paid checkout attempt and verified cart cleanup | Random request reference/digest; order reference, product IDs and quantities. No address, phone or card data. Removed on verified checkout in the same tab or session end. |
| `campusmart-offline-*` Cache Storage | Offline recovery | Public offline HTML, CSS and JavaScript only. Service worker does not cache private pages, account API responses or Supabase requests. |

Essential-only and preference actions have the same visual weight. Browsing is not blocked behind a consent wall. The notice has a dismiss control, does not auto-accept on scrolling, has no preselected optional consent, can be reopened from the footer and can reset the saved choice. If local storage is blocked, a choice can apply within the current tab without pretending it was saved permanently.

## Data minimization and consent review

- Account creation does not need a full date of birth, university ID, home address or bank details for every buyer. Age controls should use an age band; a guardian request needs only the minimum information required for its review.
- Buyer profile phone is optional; an order contact phone is requested for fulfilment, and a delivery address is only needed when delivery is selected. Free-text support/chat fields should discourage unnecessary identity and payment information.
- Vendor ID and selfie uploads are a separate, purpose-specific verification flow. Neither those documents nor buyer order details belong in public storefront data.
- Accepting buyer/vendor terms records the applicable contract version; a privacy notice acknowledgement is not blanket consent for unrelated processing. Marketing or tracking permission must not be bundled into those required acknowledgements.
- Under-18 permission needs an appropriate guardian-verification process and a record of the reviewed permission. A checkbox saying “I have permission” does not verify an adult's identity, relationship or authority. Do not present admin review as an automated identity guarantee.
- Closing a store, requesting account closure and requesting erasure are different operations. Orders, disputes, funds and legally required records cannot be silently abandoned or described as instantly erased. The settings UI and policies must match the actual server workflow and retention decisions.

## Claims, reviews and fees

- The old `src/config/site.ts` description claimed “The #1 marketplace for Nigerian university students” without supporting evidence. Replace it with a descriptive claim, and review all reused metadata, footer and hero text.
- The old configuration hardcoded `support@campusmart.ng`. The operator must confirm a functioning contact channel; policy pages use the in-app Contact route instead of inventing a legal name or a monitored mailbox.
- The database review function in `202610310001_buyer_features.sql` requires a received, paid purchase. Trial orders are unpaid and cannot qualify. Do not render a default five-star score where a genuine rating is absent or call vendor reference prices independently verified historical discounts.
- `202611010003_review_integrity.sql` makes product review counts and averages server-derived from actual review rows, including when a vendor supplies those summary columns directly. It reconciles existing summaries without creating, deleting or editing source reviews. This prevents forged aggregate scores; it does not retrospectively certify the authenticity of every legacy review record.
- Current buyer service fee is 2% below NGN 20,000 item subtotal, waived at or above that amount; delivery is excluded from this threshold. Current vendor commission is 5% of item subtotal. Show charges before committing an order; a future payout/transfer fee must be disclosed rather than deducted silently.
- A vendor identity-review badge is not a guarantee of merchandise quality, authenticity or future performance. Delivery estimates are vendor estimates. Refund decisions and completed bank refunds are separate states.

## Operational details still requiring owner verification

The repository cannot establish the operator's registered legal name, physical/contact address, live hosting provider, Supabase project region, database backups, log-retention periods, SMTP provider, processor contracts, international-transfer safeguards or exact tax/accounting retention duties. Confirm these before public launch and complete the policy's controller/contact and retention details with qualified local review. Do not publish invented information or a “fully compliant” claim.

The under-18 permission process needs an operational method for contacting/checking a guardian, evidence-handling rules and retention limits. Collecting ID simply because a text box exists is not data minimization. Use a controlled process, collect only what the review actually needs and explain that process before receiving documents.

The owner selected guardian-reviewed access for under-18 students, including selling only where permission expressly covers store operation. Buyer-only permission must not enroll a seller or publish listings. The guardian must separately accept the vendor responsibilities, including commission, fulfilment and refund duties, and the administrator must review that scope. Platform permission does not establish a minor's legal capacity to contract or satisfy bank/payment-provider eligibility. Before enabling real money, obtain a qualified review of the minor/guardian contracting arrangement and the provider's account-holder, KYC and payout requirements. The student-email match hash remains personal information; it is not an anonymous identifier.

The refund policy preserves statutory rights and avoids an arbitrary platform deadline or blanket “no returns” term. Payment, refund and payout policy text needs another review when Paystack is implemented. Automatic payout policy is not active merely because it was discussed in a previous planning conversation.

## Dependency advisory check

A production-only `npm audit --omit=dev --json` check completed with network access on 1 November 2026, after the restricted environment could not reach the advisory service. It reported **24 vulnerable dependency packages: 2 critical, 14 high, 7 moderate and 1 low**. These are registry findings, not proof that every advisory is reachable in CampusMart. The raw snapshot is [dependency-audit-2026-11-01.json](dependency-audit-2026-11-01.json). No packages were automatically updated by this audit.

| Direct dependency | Installed | Audit severity | Reported remediation |
| --- | --- | --- | --- |
| Next.js | 16.2.7 | Critical | npm reports 16.4.3 as the same-major fix target. Review installed version guidance and migration notes before upgrading. Findings include Proxy/Server Action issues and conditional Windows/image/`use cache` vulnerabilities. |
| Zod | 4.4.3 | High | Collection-validation advisory affects versions below 4.6.6. Update Zod independently; npm's aggregate suggestion routes through a shadcn downgrade and must not be applied blindly. |
| shadcn CLI | 4.10.0 | High | This tooling package is currently in production dependencies. Its transitive SDK/server tooling contributes findings, including the other critical package. Reassess runtime need; do not accept npm's proposed downgrade to 1.0.0 without review. |

The critical `proxy-addr` 2.0.7 finding is under `shadcn -> @modelcontextprotocol/sdk@1.29.0 -> express@5.2.1 -> proxy-addr`; `@hono/node-server` 1.19.14 is also under the CLI's SDK. These tooling findings are distinct from the direct Next.js runtime findings. Snapshot counts will change as the dependency owner remediates packages; rerun the audit after changes and preserve the original snapshot as evidence of this review.

### After the first remediation pass

The implementation owner updated Next.js and its ESLint configuration to 16.4.3, updated Zod to 4.6.6 and removed the unused shadcn production generator. A fresh production-only registry audit on the same date reported **2 remaining vulnerable dependency packages: 0 critical, 1 high and 1 moderate**. None of the direct dependency findings from the original report remain. The second raw snapshot is [dependency-audit-2026-11-01-after.json](dependency-audit-2026-11-01-after.json).

| Remaining production package | Installed | Severity | Dependency path | Patched version reported by the advisory |
| --- | --- | --- | --- | --- |
| `baseline-browser-mapping` | 2.10.33 | Moderate | `next@16.4.3 -> baseline-browser-mapping` | 2.11.0; npm reports a fix is available. |
| `source-map-js` | 1.2.1 | High | `next@16.4.3 -> postcss@8.5.23 -> source-map-js` | 1.2.2; npm reports a fix is available. |

The [baseline-browser-mapping advisory](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) concerns process termination on invalid input. The [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) concerns event-loop denial of service while parsing specially crafted indexed source maps. Package presence in the production tree does not establish that an attacker can invoke those paths through CampusMart. At this intermediate stage these were still unresolved production dependency findings. The audit owner did not make package changes; the implementation owner performed the further bounded updates recorded below.

### Final production verification after bounded transitive updates

The implementation owner then updated `baseline-browser-mapping` and `source-map-js` within the existing parent packages' permitted version ranges. The final fresh `npm audit --omit=dev --json` check reported **0 production dependency findings** on 1 November 2026. The final raw report is [dependency-audit-2026-11-01-final.json](dependency-audit-2026-11-01-final.json). The intermediate report above remains as a record of the sequence; its two findings are resolved in this final dependency tree.

| Snapshot | Critical | High | Moderate | Low | Total |
| --- | --- | --- | --- | --- | --- |
| Original production dependencies | 2 | 14 | 7 | 1 | 24 |
| After direct-package and unused-generator remediation | 0 | 1 | 1 | 0 | 2 |
| Final production dependencies | 0 | 0 | 0 | 0 | 0 |
| First audit including development dependencies | 0 | 3 | 16 | 0 | 19 |
| Final audit including development dependencies | 0 | 0 | 16 | 0 | 16 |

The first full audit reported **19 findings when development dependencies were included: 3 high and 16 moderate**. The implementation owner then patched the high-severity `brace-expansion`, `browserslist` and `js-yaml` packages. A fresh final full-tree check now reports **16 moderate findings, with zero high or critical findings**. The remaining findings are in the ESLint/TypeScript-ESLint configuration and plugin dependency tree and are not returned by the final production-only audit. Development and CI tooling still require a separate bounded update and test pass. The earlier full-tree snapshot is [dependency-audit-2026-11-01-all-dependencies.json](dependency-audit-2026-11-01-all-dependencies.json); the latest is [dependency-audit-2026-11-01-final-all-dependencies.json](dependency-audit-2026-11-01-final-all-dependencies.json). No force-fix or automatic major downgrade was used by this audit agent.

A zero-result registry audit means no known findings were returned for this production dependency tree at the time of the check. It does not prove the absence of application bugs, validate live provider settings or certify legal compliance. The legal operator's identity, functioning public contact channel, actual hosting/processor arrangements, guardian-verification procedure and retention rules remain launch requirements awaiting owner confirmation.

## Primary references consulted

- [NDPC publication of the Nigeria Data Protection Act 2023](https://www.ndpc.gov.ng/ndp-act-2023/) and [NDPC Annual Report 2024](https://ndpc.gov.ng/wp-content/uploads/2025/01/NDPC-Annual-Report-2024.pdf), including its discussion of parental/guardian consent. Some NDPC pages rejected direct retrieval, so no automated full-law compliance claim is made.
- [FCCPC consumer rights and responsibilities](https://fccpc.gov.ng/consumers/consumer-rights-responsibilities/rights-responsibilities/): understandable information, price disclosure, accurate descriptions, fair dealings and consumer remedies.
- [Supabase SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide): cookie-based session storage and PKCE behavior.
- [Next.js font documentation](https://nextjs.org/docs/app/api-reference/components/font): font downloads at build time and self-hosted browser assets.

The policy texts are project-specific drafts based on observed behavior and the owner's confirmed business rules. These references explain the implementation choices; they do not substitute for confirmation of the operator's actual practices.
