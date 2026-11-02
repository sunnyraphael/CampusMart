# Store management, branding and checkout preferences

Apply `supabase/migrations/202611020001_store_management.sql` after payment migrations 005 and 006. No SQL was applied to your live project and live payment flags were not changed.

## Admin

**Admin → Vendor stores** lists stores, including paused and closed stores, with search and pages of 20. Each private detail page shows owner contact information, store WhatsApp, masked test/live payout accounts, listing totals, real-order outcomes, dispute history, the latest 50 order items, and recent management actions. Owner and payout information is not added to public storefronts.

Counts use distinct paid/refunded orders for this vendor, excluding trial orders, Paystack TEST payments and unpaid checkout reservations. Completed means every vendor item was received and approved. Unsuccessful means every item was cancelled/refunded. Settled orders containing both successful and refunded/cancelled items have mixed outcomes. Ongoing orders have unsettled items. Disputes count items ever reported, including resolved cases. These are operational totals, not an invented seller rating.

Message vendor opens an in-app conversation from your account. An admin cannot message their own store. WhatsApp opens the store's registered WhatsApp number in a new tab; it does not automatically send a message. If the vendor did not provide a valid number, that button is absent.

## Pause, closure and images

Vendor **Store settings → Store controls** and admin store details contain the controls. Settings use separate profile, contact, payout and store-control tabs; pause actions are amber and closure/deletion actions are red. Admin directory tiles are compact; activity and private information appear inside each store. Owner and admin pauses are independent: a vendor cannot undo an admin restriction, and clearing an admin pause does not override an owner's pause. Pausing records which listings were active, makes them drafts, and blocks publication and stale-cart purchases. Resume restores previously published listings only when no pause/closure remains. Drafts created before the pause remain drafts.

Closing a store hides listings while keeping the buyer account, messages, order records and financial obligations. Reopening keeps items as drafts for review. An admin closure cannot be undone through either the new vendor controls or the older buyer account controls.

Permanent image removal is a separate action requiring a closed store, a reason and typing `DELETE PHOTOS`. Unsettled order/dispute, wallet, refund and transfer obligations block it. It clears listing photo references and the logo and queues physical removal from the store's own `product-images` folder, including orphaned uploads. Orders and private KYC/verification documents remain for their separate review/retention process. External-hosted photos are unlinked, not deleted from another provider.

Storage failures leave durable cleanup records. The server processes up to 100 queued photos per attempt. Use **Retry photo cleanup** while entries remain; each retry also checks the store folder for orphaned uploads. The scan has safety limits for unusually large/deep folders (5,000 entries, four levels); those need operator review. Files still referenced by other listings/logos are not removed. The new controls need the server-only Supabase service-role key for folder cleanup and admin data access.

Vendor listing cards are capped at 250px on desktop. Vendor navigation uses the uploaded store logo in both previous initials positions, falling back to initials if unavailable.

## Branding

The supplied symbol was prepared with the built-in image-generation editor and saved at `public/brand/campusmart-symbol.png`. It is used in shopping, authentication, admin/vendor workspaces, footer, error/offline screens, packing slips and browser/apple icons. The embedded CampusMart wordmark underneath was removed; existing site text remains alongside the symbol.

Edit prompt: “Extract ONLY the existing navy capital C with bright blue shopping cart and graduation cap above it. Remove the entire CampusMart wordmark underneath. Preserve the existing symbol design, geometry, navy and blue colors exactly; do not redesign. Center the isolated symbol on a square genuinely transparent canvas with small equal padding. No text, no shadow, no added graphics.”

## Checkout preferences

The general fee notice has an accessible X control. Dismissal applies to all copies on every page and loading preview in the same browser, including later visits and other open tabs. It uses `campusmart-fee-notice-dismissed-v1` in local storage.

Checkout shows a short first-visit introduction with optional **Read more**. `campusmart-checkout-intro-v1:<account ID>` remembers that visit separately for each buyer on this browser. Clearing browser storage or using another browser/device can show it again. Blocked storage falls back to memory for the tab. These preferences do not pre-check terms acceptance or remove the actual order charges, total, applicable cancellation-fee disclosure, refund policy links or TEST/no-charge labels.

## Verification

118 logic/database tests passed, including authorization, independent owner/admin restrictions, stale-cart purchase prevention, real-order statistics and permanent-photo safeguards. Six browser checks passed for mobile/desktop layouts, store actions, private admin access and remembered checkout/fee preferences. All five Paystack browser regressions passed. TypeScript and production build passed; lint reports zero errors and 20 warnings. These use isolated fixtures, not your live Supabase or Paystack accounts.
