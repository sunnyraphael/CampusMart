# Limited-time zero vendor commission

Run supabase/migrations/202611050001_vendor_launch_commission.sql once in Supabase SQL Editor after the existing reliability and administrator password/PIN migrations. It is one transaction and deliberately aborts if the expected protected finance functions are missing or changed. There are no secrets, date placeholders, or automatic expiry to configure.

Verify with: select public.cm_vendor_commission_policy();
Expected: rate 0, terms_version 2026-11-05-launch-v1, ends_at null. Deploy the matching frontend only after this succeeds, so the offer and actual payouts agree.

The public wording is: Launch offer: 0% vendor commission for a limited time. No end date has been announced. Any future commission and effective date will be announced before applying to new orders. The vendor terms retain their base acceptance version with a dated launch-fee addendum; the waiver adds no new fee obligation.

Existing order items retain the historical 5% rate and all recorded wallet/transaction values. New items receive a database-controlled immutable rate and fee-terms snapshot, with the fee and net amount recorded on insertion. The application cannot choose a rate through the checkout payload, and ordinary users cannot modify the protected policy. Delivery approval, admin queue previews, vendor pending earnings and frontend estimates use the recorded order rate. Changing the policy later cannot retroactively charge launch orders. No new earnings are credited by applying this migration.

The approval-function update preserves its OID, grants, transaction PIN requirement, verified payment checks, handover/receipt checks, dispute holds and duplicate-credit protections. Transfers still use the actual credited payout. Trial/test orders still create no real vendor funds.

Buyer service fees, delivery charges, cancellation/refund rules, Paystack processing and payout-account checks are unchanged. A real 10,000-naira launch item credits 10,000 naira after approval rather than 9,500. The existing buyer service fee is still calculated separately; payment-provider processing costs do not disappear when CampusMart waives its commission, and the operator must fund approved vendor transfers accordingly.

Before ending the offer, announce the new rate and effective date, prepare matching site/terms copy, and update the protected rate and terms version for future orders. There is no automatic end-date job or silently activated charge. Retain all existing item snapshots and ledger entries. Re-run the financial regression suite and coordinate the database policy and application publication.

Validation uses isolated PostgreSQL and browser fixtures; it creates no live payments, transfers or refunds. It tests zero-fee wallet credit, old-order preservation, later rate changes, buyer-fee preservation, PIN bypass rejection, exact transfer amounts, duplicate prevention, public disclosures and mobile previews.
