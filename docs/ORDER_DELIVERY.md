# Order tracking and delivery approvals

For the current application, apply migrations 003 (delivery approvals), 004 (trial checkout) and 005 (notification compatibility) in order after migrations 001 and 002. Skip migrations already applied. If 003/004 are installed, run only `supabase/migrations/202610310005_order_update_notifications.sql`. The application does not apply migrations automatically. Each migration is transactional: an error rolls back its changes. Refresh the application after a successful run.

## Buyer

Open **My orders → Track order**. Each purchased item has independent tracking, vendor instructions, an estimated arrival/pickup time and a chronological history. Tracking refreshes every 30 seconds while visible, on window focus, or with the Refresh button. Notifications link back to the order.

When an item is on its way or ready for pickup, generate a private six-digit code at handover. Each item has its own code, even when several items share an order/vendor. Only share it after receiving and checking that item. Codes expire after 30 minutes. A replacement invalidates the previous code and can be issued at most once per minute. The plaintext appears only in the buyer's current component state; it is never stored in local storage, notifications, URLs, order rows, or the audit history. Navigating away requires generating a replacement. The database keeps a salted SHA-256 hash in a private table. Codes are not payment OTPs.

The buyer separately confirms receipt. They can report a problem after shipment, delivery reporting, or receipt confirmation, until vendor credit is approved. After credit, contact support. Confirmation does not credit the vendor.

## Vendor

Use **Orders → Details** to save an estimate, courier/rider name, reference, optional HTTP(S) courier link and instructions. Update sequentially: pending → confirmed/preparing → shipped/ready for pickup → delivery reported. Details can also be edited without advancing. Advancing from the order list preserves existing details. This is status tracking; no GPS/courier API is connected.

After handover, enter the buyer's code directly on the **Orders** card. Reporting delivery opens and focuses the code field automatically, including when the order moves to Delivery review. A visible **Delivery code** button also opens verification for shipped, delivered or received items without opening Details. On the detail page, reporting delivery focuses the existing code field. Already verified codes show confirmation instead of another entry form.

Five wrong attempts lock that code; the buyer must generate a replacement. Failed-attempt counters persist even on unsuccessful verification. Verification records handover evidence and can mark an item delivery-reported. It does not replace the buyer's separate confirmation or admin approval. A reused verified code cannot cause another status update or credit.

Order notification links use the recipient's relationship to the individual order. Their own purchases open `/orders/[id]`; sales containing their store's items open `/vendor/orders/[id]`. A vendor can receive both kinds in the same feed. Self-purchases use the buyer view. Missing or unrelated orders have no order link; lookup failures show a retry screen instead of guessing the destination.

## Admin

Open **Admin → Deliveries** (`/admin/deliveries`). Views: awaiting review, on hold, approved. The queue shows a vendor's individual item amount, the commission recorded for that order and net credit, buyer details, tracking information, handover verification, receipt confirmation, payment verification and decision history. Review after 72 hours is a follow-up flag, never an automatic approval. Hold and resume actions require a recorded note. Buyer disputes go to the existing Disputes page.

Approval requires all of the following, checked again in the database under row locks:

- An admin identity from the existing `is_admin()` function.
- A paid order with server-set `payment_verified_at` and a nonblank `payment_verification_ref`.
- Buyer-confirmed receipt, a verified code and no unresolved dispute or review hold.
- An uncredited item and an existing vendor account.

Approval atomically records the approver/note, sets release and exact commission/net amounts, credits the wallet and total earned, inserts one `earning` transaction, and records a tracking event. Repeated approval is rejected. A failure rolls back the entire transaction. No bank transfer is initiated. Approval affects only the selected item/vendor, never other deliveries in the same order.

Vendor earnings include both buyer disputes and admin review holds in the On hold amount. Received but uncredited items remain pending approval; they are not counted as wallet funds.

Dispute “return to delivery review” does not credit a wallet. It requires fresh buyer confirmation before separate delivery approval. “Refund approved” records an amount owed; it does not send a refund. Refund transfer handling belongs to the later payment integration.

Private admin decision notes remain in the immutable event history. Buyer/vendor RPC responses exclude those notes and all delivery-code secrets.

## Automatic release and reminders

The migration retires old `release_item_payout`, `confirm_item_received`, `vendor_update_item_status`, `dispute_item`, and `admin_resolve_dispute` mutation entry points. Their signatures/dependencies are preserved, execution grants are revoked and stale callers fail closed. `release_due_payouts()` becomes a no-op, so an existing cron job cannot release money. Unreleased automatic-release dates are cleared. A database trigger also rejects item release without an approved delivery and verified payment. Previously released money is not reversed or recredited.

`cm_delivery_reminders()` adds in-app reminders after 24 hours, at most once per item per 24 hours, for reported deliveries missing buyer confirmation or code verification. It never credits money. If `pg_cron` is installed, the migration schedules this function hourly as `campusmart-delivery-reminders`. Otherwise a database administrator can schedule `select public.cm_delivery_reminders();`. The routine is not executable by browser roles. No email, SMS or WhatsApp reminders are connected.

## Payment integration comes next

Real-payment checkout remains gated. Temporary, clearly labelled trial orders are described in [TRIAL_CHECKOUT.md](TRIAL_CHECKOUT.md); they can complete delivery review without creating real money. Existing real orders marked paid are not backfilled as verified; old simulated payments cannot authorize credit. The later trusted payment handler must verify the provider event, currency, database order total and reference, then set the payment-verification fields. Those fields cannot be set by authenticated/anonymous direct writes. No public RPC can mark a payment verified. Do not manually mark production test payments verified to bypass this guard.

Existing delivered/received/disputed and uncredited items receive tracking records from known delivery/receipt timestamps. Earlier events are not invented. Historical received items can generate a new code where needed; already credited items retain their historical release marker. A missing historical receipt timestamp needs support review, not an assumed confirmation.

## Verification

Database tests execute the migration against an isolated PostgreSQL-compatible PGlite instance and test permissions, sequential updates, code storage/expiry/attempts, approval conditions, wallet accounting, repeat approval, disputes, old release entry points and reminders. Browser tests use the local Supabase protocol fixture, never production accounts or payments. They exercise buyer → vendor → buyer → admin handover, errors/retries, holds, disputes, route protection, loaders and responsive light/dark layouts.
