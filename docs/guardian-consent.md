# Guardian permission and marketplace consent

Operational version: **2026-11-01**. This document describes the implemented controls and the work the operator must complete before launch. It does not establish legal compliance or replace a legal assessment of the marketplace, children’s data processing, selling or payouts.

## Apply the database changes in order

After the existing October migrations, apply:

1. `supabase/migrations/202611010001_account_controls.sql`
2. `supabase/migrations/202611010002_marketplace_consent.sql`

The coding agent does not apply these migrations to the live Supabase project. Test them in staging first, including existing accounts and open orders. The consent migration intentionally infers no permission for an existing account. New orders record the current terms version and acceptance timestamp. The current policy and consent version is `2026-11-01`.

The relevant private records are `marketplace_consents`, `marketplace_consent_events`, `guardian_permissions` and `vendor_terms_acceptances`. Admin authority comes from `is_admin()`, independently of user-editable account metadata. Consent behavior is covered by isolated tests in `tests/marketplace-consent.test.mjs`.

## New and existing accounts

All new accounts use email registration. Registration asks for an age band before displaying personal-information fields. It records an explicit, initially unchecked buyer-terms agreement and privacy acknowledgement. Marketing permission is not bundled into this agreement. The database rejects a new authentication record without a valid age-band declaration and terms acceptance. An under-18 registration also requires an already approved permission reference that matches the student’s intended sign-in email.

The account must confirm its email before it can trade. Email confirmation demonstrates control of an address; it does not verify a person’s age, identity or parental authority. No date of birth or student ID is collected for the age-band declaration.

Google sign-in is available for existing accounts. New Google accounts cannot bypass email registration: an OAuth signup without the required declarations is rejected by the authentication-table trigger. Existing Google and other legacy accounts can still sign in, then complete `/consent` before making new purchases, publishing a store or listing, or using marketplace messages. `/consent` reads the durable database records rather than trusting metadata as proof of consent.

Do not describe a Google profile, a selected age band, a checked box or a confirmed email as verified adult identity. Maintain existing email/password recovery and support access when an account needs help completing its permissions.

## Guardian request before student registration

1. The adult parent or legal guardian creates or uses their own account, confirms their email and completes current marketplace terms at `/consent`.
2. From `/guardian-permission`, they enter the student’s intended sign-in email, identify their relationship and explicitly give permission for the student’s account and the described processing.
3. Buyer permission is the default. Selling requires a separate, initially unchecked authorisation. For selling permission, the adult also accepts the vendor terms and responsibility for the student’s store under their oversight. The server requires this adult vendor-terms acceptance before recording a selling request.
4. CampusMart records a **pending** request and a reference. A request reference by itself is not approval. The guardian contacts support with the reference to arrange review.
5. An administrator completes the verification process described below and records approval or rejection.
6. After approval, the guardian shares the approved reference with the student. The student registers with the same email and records the reference during registration.

The permission record stores a SHA-256 fingerprint of the normalised student email, rather than a separate plaintext copy of that email. The raw value is necessarily processed when computing and matching the fingerprint. The fingerprint is **pseudonymous personal data**, not anonymous data: candidate email addresses can be compared with their hashes. Keep its access restricted and avoid logging request bodies, student emails, identity information or credentials.

There is no configured automatic permission-email sender. Request status is available in the guardian’s account, and reference sharing currently happens manually after review. Do not tell users that an invitation or approval email has been sent automatically.

## Admin verification and review

Use `/admin/guardian-permissions`. The operator must first define an approved, secure verification process that establishes:

- The requesting adult’s identity and adult status.
- Their parental or legal authority for the particular student.
- Their informed permission for the account and processing, including separate selling permission when requested.

Do not ask people to send identity-document photos, document numbers or student documents through ordinary CampusMart chat or support messages. Those forms are not a dedicated identity-verification channel. A suitable secure process, permitted collection, staff access, handling rules and evidence retention must be agreed before these reviews are used operationally. No automatic identity-proofing service is implemented.

The admin approval checkbox records the administrator’s attestation that they actually completed the checks. It does not perform the checks. Record the verification method, scope, decision and relevant outcome in the review note, without document numbers or unnecessary personal information. The note can be shown to the guardian, so do not include internal secrets or third-party sensitive data.

Approval requires a meaningful note and an affirmative verification attestation. An administrator cannot approve their own guardian request; another administrator must review it. A guardian must still have an active, confirmed account at approval. Pending, rejected and withdrawn requests cannot grant student access. A recorded decision cannot be overwritten through the same review action.

## Buying, selling and changes to permission

Approved buyer permission allows eligible student purchases and marketplace communication after email confirmation. Buyer-only permission does not enable a store. A selling request needs its own explicit authorisation and admin review; existing buyer permission cannot be silently upgraded.

Once selling permission is approved, the student must still explicitly accept the current vendor terms before opening a store or publishing active listings. An approved reference or a registration preference for selling does not open a store automatically. The adult’s vendor-terms acceptance remains part of selling eligibility.

The guardian can withdraw a pending or approved permission from `/guardian-permission`. To request broader selling access, withdraw the earlier permission, submit a new request and obtain a new review. The student then updates their account permission reference through `/consent`. An age-band correction requires support; changing user metadata cannot change the stored declaration.

Withdrawal, or an inactive guardian account, blocks new student trading and messages. New store/listing publication and re-publication are blocked. Withdrawing permission also moves the student store’s active listings to drafts. Closing the guardian account similarly drafts dependent student listings through a database trigger; reopening the guardian account does not republish them automatically. A database guard on new order items checks the vendor’s current permission even when a different eligible buyer places the order, so a stale cart cannot bypass withdrawal or guardian closure. Existing receipt confirmations, delivery fulfilment, disputes and support remain available so outstanding obligations can be resolved. Withdrawing permission does not delete prior orders, cancel an existing transaction, reverse a payment or automatically erase retained records. Separate account/store closure and data-removal controls are described in `docs/account-controls.md`.

## Selling and payout launch checks

Guardian authorisation is an application permission. Before allowing a student-operated store to receive real payments, the operator must settle the legal capacity, responsible adult’s oversight, contractual obligations, refunds, payout recipient ownership and the payment provider’s merchant/recipient eligibility and verification requirements. Do not assume that guardian approval by CampusMart guarantees provider acceptance or payout eligibility. The eventual payment integration must preserve those checks and the existing delivery/dispute controls.

## Owner decisions still needed

The operator’s final business identity and dedicated privacy/contact email are not yet supplied. The current policies route users to `/contact`; replace or supplement that channel with the approved operator details before launch.

Retained orders, consent evidence, guardian decisions, financial obligations and privacy requests need an explicit retention and erasure assessment. No retention period is invented here, and recording a deletion request is not a claim that every record has been deleted. Decide which records must be retained, why, for how long, who can access them and how eligible erasure will be fulfilled across CampusMart and its processors.

## Dependency audit snapshot

The compatible dependency updates pin Next.js to `16.4.3` and Zod to `4.6.6`. The saved production dependency audit at `docs/dependency-audit-2026-11-01-final.json` reports zero known vulnerabilities for that audit snapshot. This is not a guarantee of application security, absence of future vulnerabilities, verified guardian identity or legal compliance. Review `docs/third-party-audit.md` for SDK and external-resource handling, and repeat dependency and operational checks when the implementation or providers change.
