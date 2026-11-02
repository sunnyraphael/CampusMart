# Paystack setup and operations

This uses server-only Paystack APIs and hosted checkout. No browser payment SDK or public key is needed. The migrations have been tested locally; they have **not** been applied to your Supabase project. No real payment, refund or transfer was performed during implementation.

## Test setup

1. Back up your database. Apply existing migrations through `202611010004_buyer_order_cancellation.sql`, then run these complete files in Supabase SQL Editor, in order:
   - `supabase/migrations/202611010005_paystack_payments.sql`
   - `supabase/migrations/202611010006_paystack_refunds_and_payouts.sql`
2. Add the following to your local/deployed environment, retaining the existing Supabase public URL/anonymous key. Keep secrets out of Git, screenshots and chat:

   ```dotenv
   PAYSTACK_MODE=test
   PAYSTACK_SECRET_KEY=<your Paystack test secret key>
   PAYSTACK_LIVE_ENABLED=0
   SUPABASE_SERVICE_ROLE_KEY=<server-only Supabase service role key>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   CRON_SECRET=<random server-only value of at least 32 characters>
   CAMPUSMART_TRIAL_CHECKOUT=0
   ```

   Restart the development server. The browser hostname must match `NEXT_PUBLIC_APP_URL`; switching between localhost and 127.0.0.1 loses sign-in cookies on the return. Never prefix secrets with `NEXT_PUBLIC_`. Fixture environment flags are for automated tests only.
3. Use publicly reachable HTTPS staging for dependable callbacks. Set the matching Paystack test dashboard webhook to `https://YOUR-SITE/api/paystack/webhook`. The application supplies `https://YOUR-SITE/payments/callback` per transaction. Unsigned webhook requests are rejected.
4. Schedule GET `/api/payments/reconcile` every minute with `Authorization: Bearer <CRON_SECRET>`, kept in protected scheduler settings. Allow 60 seconds per invocation; monitor failures and queue growth. This bounded worker verifies payments, expires reservations and processes durable refunds/transfers. Without it, pending results can be delayed. Admin **Reconcile payment queue** provides a manual run. Local helper: `node --env-file=.env.local scripts/reconcile-payments.mjs`.
5. Test with eligible adult buyer/vendor accounts and Paystack's documented test credentials on its hosted screen. Confirm checkout, return, webhook, cancellation/refund, delivery and payout against your own staging account before enabling live mode. Automated tests use a local protocol fixture, not your keys.

## Payment and refund behavior

- The server prices orders and shows every charge before payment: buyer service fee 2% below NGN 20,000 item subtotal, waived at/above that threshold; vendor commission 5%. Checkout acceptance records payment terms `2026-11-01-payments-v1`.
- Only an exact provider match for reference, payer email, amount, NGN and test/live environment confirms payment. A redirect alone never confirms it. Retries reuse the original order/request; a lost initialization response is reviewed rather than blindly charged again.
- Stock reservations expire after 30 minutes. The worker releases inventory once, including during provider outages. Late successful charges queue full refunds instead of fulfilling expired reservations.
- Voluntary cancellation within 30 minutes, before dispatch/ready-for-pickup, retains only the disclosed CampusMart service fee. The dialog shows the exact refund; a waived fee retains zero. Paystack's processing fee is **not additionally deducted** on this route. The retained fee may not cover the operator's processing cost.
- Late-delivery/dispute refunds require admin review. The CampusMart buyer fee is returned on this reviewed route. The admin can deduct the verified, allocated Paystack processing cost only where lawful and disclosed. Full statutory remedies remain available without deductions; full refund is the default. Record evidence and reasoning: a checkbox alone does not establish entitlement to deduct a fee.
- Refund approval/cancellation does not mean bank credit. Provider states include pending, processing, needs-attention, failed and processed. Even processed can require additional bank time.
- TEST payments are explicitly labelled, restore reserved stock on verification, do not credit real wallets and cannot create purchase-verified reviews. Trial checkout remains a separate unpaid simulation.

## Vendor payouts

Vendors use `/vendor/payout-account` to resolve a bank account with a recent sign-in. The new private recipient table stores provider reference, resolved name, bank and last four, rather than the full account number. Legacy bank fields are not trusted payout instructions. Verify beneficiary ownership and provider KYC before paying.

Payment verification, delivery code, buyer receipt and admin delivery approval remain required for vendor credit. A wallet credit is separate from a bank transfer. In `/admin/payments`, review the exact amount and beneficiary, then authorize the transfer. A changed bank account or amount invalidates a stale confirmation. Live transfer funds are reserved once; verified failure/reversal restores them once. Transfer provider charges are not silently subtracted from the approved vendor amount. Maintain sufficient Paystack balance.

## Admin operations and recovery

- The finance screen shows the latest ten payments and all their refund jobs, plus the latest 60 transfer jobs. Find older payments by full reference or order UUID. Workers reconcile durable pending jobs independently of these display limits.
- Uncertain refund requests are never blindly resent: reconciliation searches the original transaction and unique merchant note. If no result is found, investigate the existing request in Paystack/support. Only a definitively rejected request without provider ID has an explicit retry button.
- Complete needs-attention refunds as the existing request in Paystack, then reconcile. Do not submit an additional dashboard refund. Externally created refunds require operator reconciliation before further CampusMart refunds.
- Complete transfer OTP approval for the existing transfer in Paystack. Uncertain transfers are checked by original reference. Failed/reversed/abandoned jobs permit a fresh reviewed request after balance restoration. Queued/blocked unsent jobs can be cancelled to restore their reserve; in-flight jobs cannot.
- Provider disputes/reversals hold payment funds. Clearing an ordinary delivery hold does not clear a provider payment hold. Releasing provider-review holds and recovering already credited/transferred funds remain manual finance tasks requiring ledger and provider evidence. Credited-item refunds are blocked until recovery is resolved. **Automatic payouts while the admin is offline are not enabled.**
- Shipped/returned goods are not automatically restocked by refund; inspect returns before updating inventory. Legacy balances are not automatically certified for new transfers.
- Paid checkout and payout setup currently require adult accounts. Guardian-approved under-18 users can use permitted platform features but cannot pay/sell through this integration until a compliant guardian-supported provider arrangement is established.
- Account closure remains blocked during unsettled payments/refunds/transfers/balances. Keep necessary financial records under a documented retention schedule; provider-held records are separate. Do not promise deletion of regulated transaction records.

## Live launch

After staging validation, configure the matching live secret, `PAYSTACK_MODE=live`, `PAYSTACK_LIVE_ENABLED=1`, public HTTPS app URL, strong reconciliation secret and monitored worker/webhook. Confirm business approval, marketplace fund-holding/payout eligibility, KYC, funding, fees and refund conditions with Paystack. This code does not establish a licensed escrow service. Complete missing legal business/contact details and review the actual refund terms before launch.

Official references: [transactions](https://paystack.com/docs/api/transaction/), [refunds](https://paystack.com/docs/api/refund/), [webhooks](https://paystack.com/docs/payments/webhooks/), [transfers](https://paystack.com/docs/transfers/single-transfers/).

## Verification

Run `npm test`, `npx tsc --noEmit`, and `npm run lint`. The isolated payment browser suite is `npx playwright test --config=playwright.paystack.config.ts --reporter=list`. Run a production build with `CAMPUSMART_BUILD_CHECK=1` to isolate artifacts from a running dev server. Fixture tests do not verify your actual provider account configuration.

Implementation checks on 1 November 2026: 113 logic/database tests and 18 browser checks passed (five payment checks and 13 trial/mobile regressions). TypeScript and the production build passed; lint reported zero errors and 16 warnings. Staging with your actual test keys, live SQL setup, webhook registration and scheduled reconciliation remain deployment steps.
