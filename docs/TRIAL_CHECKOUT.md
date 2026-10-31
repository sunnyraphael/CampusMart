# Temporary trial checkout

Apply `supabase/migrations/202610310004_trial_checkout.sql` after migration 003, then apply `supabase/migrations/202610310005_order_update_notifications.sql` and refresh the app. If 003/004 are already applied, run only 005. Do not rerun already-applied migrations. No live database changes are made by the application build.

Migration 005 preserves the five original notification types and adds `order_update`. Without it, the original `notifications_type_check` rejects the new checkout/tracking notifications with error `23514`, rolling back the whole order. The database tests reproduce this exact pre-fix failure, check rollback, then exercise the workflow after the repair.

Trial checkout is on by default with `npm run dev`. Production defaults to the closed payment gate. To deliberately enable a deployed/production trial, set the server environment variable `CAMPUSMART_TRIAL_CHECKOUT=1`. Set it to `0` and restart/redeploy to disable trial checkout in any environment. It is not a public/browser setting. Creation runs through an authenticated server action and a service-only database RPC; the existing server-side `SUPABASE_SERVICE_ROLE_KEY` is required. No public RPC can create a trial for an arbitrary buyer.

## Test the procedure

1. Sign in as the buyer, add an available product to the cart, and open Checkout.
2. Choose pickup or delivery, enter a Nigerian contact phone number and, for delivery, a campus address. Select **Place trial order**.
3. The receipt shows the test total and **Amount charged: ₦0**. Open **Track trial order**.
4. As that item's vendor, open **Vendor → Orders**, confirm the order and mark it shipped or ready for pickup. Details is optional for editing delivery instructions.
5. As the buyer, generate the private delivery code at the test handover. As the vendor, report delivery to open code entry on the order card, or select **Delivery code** directly. Enter and verify the code there.
6. As the buyer, confirm receipt. You can instead test reporting a problem; admin must resolve it before approval.
7. As an admin, open **Admin → Deliveries**, review the trial evidence, select **Approve trial delivery**, add a note, and select **Confirm trial approval**.

You can test with an item from your own vendor account and switch between buyer/vendor views in the same login. Admin approval still requires an account present in the existing admin table. No admin privilege is granted by trial mode.

## What is simulated

- Trial orders are permanently flagged `is_trial=true` and remain `payment_status='unpaid'`. They cannot be converted into real orders, marked paid, or given payment-verification references.
- Prices, stock availability, the 2% service fee below ₦20,000, fee waiver, and trial delivery charge of ₦500 are checked/calculated in the database. A changed total requires refreshing prices and reviewing it again.
- Stock is checked but never reserved or reduced. No real payment provider is called.
- Trial labels appear in buyer orders, vendor orders, admin delivery/dispute views and printed packing slips. Internal order notifications are prefixed as trials. Do not treat them as paid sales.
- Delivery status changes, private codes, buyer confirmation, holds, disputes and admin approval use the normal workflow. There is no payment-verification requirement for a trial because no real credit can result.
- Approval records the simulated net amount and a release/completion timestamp on the trial item. It skips all wallet, total-earned and transaction writes. A separate database trigger also blocks real transactions linked to a trial item.
- Vendor sales totals, actual pending earnings and reviews exclude unpaid trial purchases. There are no automatic payment transfers or refunds. Trial disputes/refund decisions are labelled as simulations.

Retries reuse a buyer-scoped checkout request ID. The database returns the same order for the same attempt, so a response lost after creation does not duplicate it. The cart is consumed only after a confirmed response; new quantities/items added while submitting are preserved. The browser stores only a nonce and payload digest in session storage, never contact details or delivery codes. If browser hashing/storage is unavailable, same-page retries retain an in-memory attempt. At most five new trial orders can be created per buyer per 30 minutes.

## Later Paystack integration

Disable the trial switch. Replace the closed real-payment action with payment initialization and verified webhooks. Real orders keep the existing server-verified payment guard before admin credit. Keep trial records clearly flagged and excluded from financial reporting; do not convert old test orders into real payments. No payment-gateway implementation is part of this change.
