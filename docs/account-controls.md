# Account and privacy controls

Apply `supabase/migrations/202611010001_account_controls.sql` after the October migrations and before `202611010002`. The migration is not applied by the coding agent. It preserves existing orders, balances, identity records and messages. Test in staging before using the controls with live accounts.

## Buyer and store-owner controls

`/settings/account` is available to signed-in users, including people whose account has been deactivated. Support must remain reachable so people can exercise privacy rights or appeal a closure. `/settings` links to these controls and has `privacy-controls` and `account-controls` section IDs.

- **Close store only:** `cm_set_store_closed(true)` records `sellers.store_closed_at` and changes active products to drafts. The buyer account stays active, and existing fulfilment, dispute and payout obligations remain. Closed stores cannot publish active listings or receive new order items. Reopening uses `cm_set_store_closed(false)` and leaves products as drafts for the owner to publish individually.
- **Close account only:** records a request. An open store must first be closed, or the owner can select both closures.
- **Close account and store:** closes the store immediately and records an account-closure request. Cancelling a pending request does not automatically reopen the store.
- **Delete eligible personal data:** records an owner-only request without closing the account. This request is not an automatic claim of erasure. Data removal needs a retention assessment and manual fulfilment. The administrator cannot mark it completed through the account-closure endpoint.

Request details are optional, limited to 1,000 characters, and tell the user not to provide passwords, payment details or identification documents. Confirmation checkboxes start unchecked. Request retries return the existing open request. Only the owner can cancel a request that is still pending.

## Admin review

`/admin/account-requests` reads the oldest 100 requests for the selected open/past view. It supports text search, request-type filters and immutable event history.

`cm_admin_review_account_change` checks `is_admin()` and supports:

- `in_review`: records a user-visible update and keeps the case open.
- `decline`: closes the request with a required explanation.
- `approve_closure`: only for account-closure requests; rejects self-approval, unsettled order items, outstanding delivery reviews/disputes, nonzero vendor wallets and account-only requests whose store is open. It closes the store, unpublishes its listings and records account deactivation in `account_access`. It does not delete records or the authentication identity.

The database blocks deactivated accounts from purchases, listings, messaging and other existing application writes. Restrictive policies protect direct table access, while mutation triggers also protect writes made through older security-definer RPCs. Support and privacy-request tables are intentionally excluded so those channels remain usable. The application routes deactivated users to the controls rather than claiming that their authentication identity has been deleted. Existing security-definer read RPCs may still return the owner's retained records; those functions retain their original participant authorization rules.

Actual erasure, retention decisions, external-processor requests and any eventual Supabase Auth deletion are operational tasks. Do not mark data-removal requests fulfilled merely by changing a database status. Record what was removed and what was retained when adding the eventual erasure worker and completion workflow. No retention duration is invented here.

## Integration

`cm_account_status()` returns `{active, closed_at, has_store, store_closed_at, requests}` for the authenticated caller only. `cm_account_is_active(uuid default auth.uid())` returns a boolean and can be used by checkout, enrollment and consent guards. It exposes no names, contact details or request contents.

Requests and review history have owner/admin SELECT policies; all client INSERT/UPDATE/DELETE privileges are revoked. All writes use checked RPCs. Store state cannot be changed by a direct authenticated seller update. `account_access` has no client table privileges. Admin authority comes from `is_admin()`, not metadata or a user-supplied role.

The cookie-preferences button dispatches `campusmart:cookie-preferences`. The shared consent banner should listen for this event.

## Browser fixture hooks

Return a mutable state object from fixture RPC `cm_account_status` with the shape above. Implement these fixture RPCs for UI tests:

- `cm_set_store_closed`: toggle the store's closed timestamp, and draft its active fixture listings.
- `cm_request_account_change`: append a pending request of the requested kind, preserving existing open requests for retries.
- `cm_cancel_account_change`: change the caller's pending request to cancelled.
- `cm_admin_account_requests`: return pending/in-review or past request rows, including `full_name`, `email`, `store_name`, `store_closed_at` and an `events` array.
- `cm_admin_review_account_change`: append a review event and update status; `approve_closure` sets `active:false` only for account closure, never for a data-removal request.

SQL behavior is checked independently in `tests/account-controls-database.test.mjs` using an isolated PGlite database. It does not contact the live Supabase project.
