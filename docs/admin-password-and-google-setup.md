# Admin password, transaction PIN and Google signup

## Activate the code changes

Apply these one-time migrations in Supabase SQL Editor after the earlier security-hardening migration:

1. supabase/migrations/202611030002_admin_password_and_pin.sql
2. supabase/migrations/202611030003_google_signup.sql

Deploy the matching application code after applying both. The current hosted version is not changed just by editing local files. Coordinate the migration and deployment because the old authenticator UI cannot unlock the replacement password session. No SQL, existing MFA factor, password, PIN or Google OAuth secret was changed in the live project during implementation.

## Admin access

Visit /admin-security using your existing administrator account. Enter the same CampusMart password you already use. Supabase verifies it, and the database requires its signed authentication timestamp to be no older than five minutes before unlocking this session. You do not create a separate admin password. Google-only administrators can use the existing password-reset flow to set their CampusMart password first.

The unlock lasts eight hours and is bound to the current authenticated user and session ID, with active-account and administrator membership checks. Other browsers/sessions do not inherit it. Signing out attempts to remove the unlock before ending the account session. Existing MFA factors are retained, but no longer required by the app's is_admin gate, as requested. This password/PIN arrangement is less phishing-resistant than enforced MFA.

On first unlock, choose and confirm a six-digit transaction PIN. Repeated digits and obvious ascending/descending sequences are rejected. A salted bcrypt cost-12 hash is stored in a private, RLS-enabled table. Plaintext PINs are not stored or logged by application code. Changing the PIN requires a fresh account-password verification and the current PIN. The admin header's Password & PIN link opens that flow. Forgot-PIN recovery has no email/password-only bypass: an authorised project operator must verify identity and clear the credential through controlled database administration before re-enrolment. Record that intervention in your operator audit trail.

Five wrong PINs persistently lock financial decisions for 30 minutes. A correct PIN does not bypass an active lock. Incorrect old PINs while changing the PIN use the same counter. Admin password failures remain subject to Supabase Auth limits and optional CAPTCHA.

## Financial decisions

After reviewing a decision's amount, beneficiary and evidence, confirm it in a PIN dialog. PIN approval is required for vendor wallet credit, transfer/refund requests, dispute decisions, changes to delivery holds, cancellations of unsent transfers and retries of definitively rejected refunds. The same rule applies to test/trial decisions. It is not a reusable browser flag: the PIN is checked and the existing checked finance function runs in one database transaction, with one-time permission bound to its transaction ID, operation and target. Direct calls to the old finance RPCs are rejected. Original ownership, delivery evidence, exact-amount, beneficiary-version and duplicate-payout checks still run.

The PIN goes directly to the authenticated Supabase RPC over HTTPS, not into a Next.js server-action argument. Already-approved job reconciliation and scheduled processing do not require typing another PIN; they process the same durable approved record, not a new financial decision. Unknown results are never automatically resubmitted by the PIN dialog. Close it and check/reconcile existing records. The server-only Paystack and Supabase environment settings must still be configured manually on Netlify by the operator.

## Enable Google in the provider dashboards

Google cannot work end-to-end until these external settings exist. No new Google secret belongs in NEXT_PUBLIC variables or chat.

1. Open your Supabase project: Authentication -> Sign In / Providers (or Providers) -> Google. Copy its **Callback URL (for OAuth)**. It has the shape https://PROJECT_REF.supabase.co/auth/v1/callback.
2. In https://console.cloud.google.com/ create/select the CampusMart project. Open Google Auth Platform (older UI: APIs & Services -> OAuth consent screen). Fill in Branding with CampusMart and your real support/developer email. Choose the appropriate External audience. For the initial Testing audience, add your and your pilot testers' Google email addresses as test users.
3. Open Clients -> Create client (older UI: Credentials -> Create credentials -> OAuth client ID). Choose **Web application**. Add https://campusmart-pilot.netlify.app as a JavaScript origin; add http://localhost:3000 only if testing locally. Paste the Supabase callback URL from step 1 into **Authorised redirect URIs**. Do not substitute the CampusMart /auth/callback URL in this Google field.
4. Copy the generated Client ID and Client secret directly into the Supabase Google provider settings. Enable the provider and Save. Use only identity/email/profile scopes; CampusMart does not need Gmail, Drive or Contacts access.
5. Supabase Authentication -> URL Configuration: Site URL https://campusmart-pilot.netlify.app. Add https://campusmart-pilot.netlify.app/auth/callback to Redirect URLs. Keep http://localhost:3000/auth/callback if local development is required. Avoid wildcard third-party domains.
6. Test both login and registration with a listed test account. Follow Google's publication/verification instructions when opening OAuth to people outside the Testing audience. Keep the app's Privacy and Terms links accurate.

Official references:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://developers.google.com/identity/protocols/oauth2/web-server

## Google signup behavior and data

Existing Google users sign in through Login. New users begin on Register, select an age band, accept the terms, and enter the exact Google email they will select. They do not need to fill an email password for Google signup. Under-18 registration requires an already-approved guardian reference matching that Google email before an intake is created. A wrong/different Google email will be rejected by the signup trigger; restart registration with the matching address.

The intake stores a SHA-256 email hash, declared age band and guardian-reference ID for a 15-minute attempt, and no password. Repeated requests for the same unexpired intake reuse it. Per-email and overall creation limits bound storage growth; records older than one day are cleaned up on subsequent preparations. These application limits are not upstream bot protection; provider/edge rate limits and monitoring remain necessary.

The database recognises Google through provider-controlled app metadata, not user-editable profile metadata. Creating the identity records a pending-google terms version; it grants no trading access. The callback sends the signed-in person to Account permissions to confirm the terms. Database permission functions continue blocking buying, selling and messaging until valid consent and any guardian approval are present. Vendor users still complete separate store terms. OAuth callbacks use PKCE through the existing Supabase SSR integration.

## Validation limits

Tests use isolated PostgreSQL with the actual pgcrypto extension and finance functions plus browser protocol fixtures. Google itself must still be tested after the owner configures the provider credentials. A successful fixture test is not proof that Google Cloud or Supabase dashboard configuration is complete.
