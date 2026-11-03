# Security hardening setup

This change addresses the six findings from the November 3 security review. It is not a guarantee against all attacks. No live SQL, funds, customer records, or MFA factors were changed during implementation.

## Database and image ownership

1. Back up the database. Apply `supabase/migrations/202611030001_security_hardening.sql` after `202611020002_reliability.sql` in Supabase SQL Editor. The migration is transactional and intended to run once.
2. In a terminal in the project folder run:

```powershell
node --env-file=.env.local scripts/configure-security.mjs
```

This operator-run command configures the exact public Storage origin using the existing server-only service-role key. It does not print credentials or change customer data. New image attachment fails closed until this succeeds. Repeat if the Storage custom domain changes.

New listing photos and logos must name an existing object in the current project's public product-images bucket under that seller's folder. Listings permit five photos. Unchanged legacy references are retained; existing foreign references cannot keep another seller's files pinned by the maintenance worker. Review old non-owned/external URLs before launch and re-upload them through the editor. This does not publish private KYC files or bulk-delete images.

## Administrator authenticator

Enable TOTP MFA in Supabase Auth. After the migration, visit **/admin-security** while signed in as an existing administrator. Set up an authenticator by scanning the private QR code, save a secure recovery copy of its setup key, and enter the current code. Existing enrolled TOTP factors can be used instead.

All existing admin checks and RLS policies using is_admin now require aal2 and an MFA authentication no older than 15 minutes. Existing admin-policy function dependencies remain intact. Membership is a separate self-only boolean used to show the menu and verification screen; membership alone cannot authorise financial operations. The verified authenticator timestamp, not a browser flag, controls access. There is no test-mode bypass.

Reverify at /admin-security when access expires. A pending form may be rejected when the verification window ends; unlock and review it again. If the authenticator is lost, an authorised Supabase project operator must verify the person's identity and reset the MFA factor through the provider's administrative tooling. No password/email-only recovery bypass is implemented. Keep project-owner MFA and recovery access secured separately. Do not enable real transfers before testing enrolment, wrong codes, expired MFA and recovery with a dedicated staging administrator.

## Reservations, worker and payment checks

Each account may have two outstanding unpaid reservations, with five units of one product and 25 units overall in a new checkout. Existing over-limit reservations are not silently cancelled. The third new reservation fails atomically so stock deductions roll back. The existing ten-checkouts-per-hour account cap remains.

Keep /api/payments/reconcile scheduled every minute with the secret Bearer header. Before any provider lookups it expires up to 50 due reservations in a database-only batch. Checkout also expires up to 20 due reservations before creating a new one. Historical expired payment verification is separated from active payment verification, limited to one per invocation, no more than hourly per reference, for seven days after creation. Signed provider webhooks still process later verified charges; long-delayed missing webhook cases require administrator review. Late successful payments retain the existing refund/review behavior instead of fulfilling released stock.

Buyer callback/status requests share an atomic 15-second provider-check cooldown per payment reference. Webhooks and authorised reconciliation are not skipped by that buyer cooldown. A cooldown result uses recorded server state and never trusts the browser as proof of payment.

## Rate limits and trusted network identity

Database triggers enforce 20 changed profile updates and 30 listing creations/edits per account per hour, plus a 200-listing store quota. Existing support, conversation and saved-search limits remain. Clearing store images during closure is exempt from publication counting. Server-side service stock updates do not use the vendor's publication budget.

Network checkout limits are available as an additional guard, **only behind a trusted ingress** that overwrites the client-IP header and prevents direct origin access. Set this server-only variable when that condition is met:

- Vercel: CAMPUSMART_TRUSTED_IP_HEADER=x-vercel-forwarded-for
- Cloudflare with a protected origin: CAMPUSMART_TRUSTED_IP_HEADER=cf-connecting-ip

Do not trust arbitrary X-Forwarded-For values, or enable a header merely because a visitor can send it. Local development can leave the setting unset. Configured network checks fail closed if the trusted address is missing/invalid. HMAC identities use CRON_SECRET; raw IP addresses are not stored. The cap is 60 checkout attempts per network per hour, with quota rows expiring after two days. Account and reservation guards apply regardless of this setting. Review the cap for campus NAT/shared Wi-Fi before a pilot; use provider WAF/rate limits for anonymous floods, account-farm abuse and distributed attacks. Application limits cannot prevent an upstream bandwidth flood.

## Browser policies

Responses add DENY framing, nosniff, strict-origin-when-cross-origin, a restrictive permissions policy, and a baseline CSP blocking external framing, plugins and foreign form targets. CSP allows required inline scripts/styles and Cloudflare's challenge, and retains development live-reload support. It is not a strict nonce-based XSS policy. Paystack hosted checkout uses top-level navigation; Supabase uses HTTPS/WebSocket access. Test Google login, CAPTCHA, photos, TOTP QR display and checkout on staging after enabling the headers. Custom Supabase domains need their origin added to connect-src. HTTPS/HSTS, edge bot protection, SMTP controls and database policies must also be verified on the deployed host.

## Verification

The security database tests use the real migration and expiration functions in an isolated PostgreSQL-compatible database. They check existing admin RLS dependency behavior, MFA freshness, outsider rejection, image ownership, gallery limits, direct-write quotas, reservation caps, idempotent expiry, network budgets and payment-check cooldowns. Browser fixtures cover administrator verification and headers without sending real payments or contacting the live Supabase project.
