# Vercel deployment for the CampusMart user trial

Deploy the current combined application. Keep real payments disabled. Deployment to Vercel's Production environment means the stable site address; it does not require Paystack live mode.

## Account and plan

Use your own Vercel account/team. CampusMart is a marketplace; select a plan permitting commercial use, or confirm eligibility with Vercel. Hobby is restricted to personal non-commercial use: https://vercel.com/docs/plans/hobby . No subscription or paid upgrade is authorised by this guide.

Git repository: sunnyraphael/CampusMart. Local security changes must be committed and pushed before a Git-based deployment will contain them. A CLI deployment can upload the current working tree without pushing. The .vercelignore file excludes local environment files, backups, tests and operational scripts from CLI uploads. Environment secrets must be configured separately.

## Project settings

- Framework: Next.js.
- Root directory: repository root (./).
- Node.js: 24.x.
- Install: npm ci; build: npm run build; output: framework default.
- Never set CAMPUSMART_E2E, CAMPUSMART_PAYSTACK_FIXTURE or CAMPUSMART_BUILD_CHECK on the hosted project.

## Environment variables

Copy only the required values privately from local configuration into Vercel project settings. Do not commit .env.local or send credentials in chat.

| Name | Hosted setting |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Existing Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Existing public anonymous key |
| SUPABASE_SERVICE_ROLE_KEY | Server-only service-role key |
| NEXT_PUBLIC_APP_URL | Exact stable HTTPS address assigned to this project |
| PAYSTACK_SECRET_KEY | Test key only (sk_test_...) |
| PAYSTACK_MODE | test |
| PAYSTACK_LIVE_ENABLED | 0 |
| CAMPUSMART_TRIAL_CHECKOUT | 0 for Paystack test checkout |
| CRON_SECRET | Existing random server secret, at least 32 characters |
| NEXT_PUBLIC_SUPPORT_EMAIL | Optional actual support address |
| WHATSAPP_NUMBER | Optional actual support contact |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | Only after the corresponding Supabase CAPTCHA and domain setup |
| CAMPUSMART_TRUSTED_IP_HEADER | x-vercel-forwarded-for, only after confirming trusted hosting configuration |

Do not upload backup encryption keys/database backup credentials. Leave CAMPUSMART_DEV_ORIGIN unset on Vercel. Apply the security SQL migration and configure the image Storage origin before accepting uploads or testing paid checkout. Read docs/security-hardening-setup.md.

After changing NEXT_PUBLIC_APP_URL or other environment variables, redeploy so build-time values match the hosted address. Do not leave localhost or the temporary Cloudflare link as the hosted site URL.

## Supabase and Paystack callbacks

In Supabase Authentication URL Configuration, set Site URL to the stable Vercel HTTPS address and add its exact /auth/callback URL to Redirect URLs. Keep http://localhost:3000/auth/callback if local development is still needed. Do not allow wildcard third-party domains. Registration confirmation, password-reset and Google sign-in must be tested on the actual hosted URL.

In Paystack TEST settings, set the webhook to the stable Vercel address followed by /api/paystack/webhook. Keep all keys in test mode. Do not change live-mode settings during this preview deployment. The application supplies /payments/callback during checkout initialisation using NEXT_PUBLIC_APP_URL.

## Background jobs and public access

Keep separate secret-authenticated GET schedules: /api/payments/reconcile every minute and /api/operations/maintenance every five minutes. Review the selected hosting/scheduler plan's scheduling limits; adding this document does not configure a scheduler. Never put CRON_SECRET into a URL or a public monitoring dashboard. See docs/reliability-setup.md.

Use the stable production-domain link for testers. Verify it in an incognito browser so Vercel deployment protection does not accidentally require testers to sign into Vercel. Do not disable CampusMart's own login or admin MFA.

## Smoke checks

Confirm public homepage/products load; /api/health returns 200; unauthenticated worker calls return 401; sign-in and password recovery use the hosted origin; ordinary buyers cannot enter /admin; administrators reach /admin-security and verify TOTP; vendors can upload photos; checkout clearly says TEST and completes only a simulated charge. Recheck the Supabase usage dashboard during the pilot. No real charges, payouts, refund requests or bulk emails are needed for deployment verification.
