# CampusMart Netlify user-trial deployment

This deploy keeps the combined buyer, vendor and administrator application and uses the existing Supabase project. It must not enable live Paystack payments or start a paid subscription.

## Build and upload

netlify.toml uses Node.js 24, npm run build and the .next output, with the current OpenNext adapter enabled explicitly. The adapter is also configured in this site's Netlify settings because the initial remote build uses the already-pushed application commit. This is a dynamic Next.js application, not a static HTML export. Do not upload just the public folder, raw .next files, or use a static SPA redirect. Test proxy authentication, route handlers and server actions on the actual deployment.

Build this project's Node proxy on Netlify's Linux build service: the local Windows edge packager failed to resolve its Turbopack runtime paths. The site is linked to the public sunnyraphael/CampusMart repository with a read-only deploy key. A Linux build avoids changing or disabling the access-control proxy. The linked project can be built from Netlify's dashboard; automatic push-trigger hooks should be verified separately before relying on them.

The GitHub remote is sunnyraphael/CampusMart. Local security changes need committing/pushing before a Git-based deployment includes them. A CLI deploy can deploy a prepared copy of the current source. Never include .env.local, backups, .git, .aws, .codex or .agents in a source upload. .netlify state is gitignored and must stay local. Do not repurpose/delete the developer's active .next directory for local deployment builds; use an isolated build copy or a remote build.

## Site environment

Set the actual values privately using Netlify site environment settings/API. This free workspace requires the default All scopes; use that default and the Production context. Values declared only in netlify.toml are build settings and are not a substitute for runtime configuration. The owner chose to enter private keys manually; do not automatically export them from .env.local.

- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY: existing project settings.
- SUPABASE_SERVICE_ROLE_KEY: server-only, never given a NEXT_PUBLIC prefix.
- NEXT_PUBLIC_APP_URL: the exact stable https://SITE.netlify.app address.
- PAYSTACK_MODE=test, PAYSTACK_LIVE_ENABLED=0, CAMPUSMART_TRIAL_CHECKOUT=0.
- PAYSTACK_SECRET_KEY: existing test key beginning sk_test_. Do not upload a live key.
- CRON_SECRET: existing server-only random secret, at least 32 characters.
- Optional real support contact variables: WHATSAPP_NUMBER and NEXT_PUBLIC_SUPPORT_EMAIL.
- NEXT_PUBLIC_TURNSTILE_SITE_KEY only if the hosted domain and matching Supabase CAPTCHA secret are configured.

Do not copy backup encryption keys or backup database credentials. Leave CAMPUSMART_E2E, CAMPUSMART_BUILD_CHECK, CAMPUSMART_PAYSTACK_FIXTURE, CAMPUSMART_DEV_ORIGIN and Vercel-specific trusted-IP settings unset. Network identity protection must be adapted to a provider-verified Netlify header before enabling that optional guard; account and reservation limits remain enforced in the database.

The security and reliability tables and matching Storage-origin setting were confirmed by read-only checks on November 3, 2026. That is not proof of every database policy or admin authenticator enrolment. Do not rerun one-time migrations just because deployment is new.

## After the address is assigned

1. Set NEXT_PUBLIC_APP_URL to the stable Netlify HTTPS URL before the final build.
2. Supabase Authentication URL Configuration: set Site URL to that origin and add its exact /auth/callback URL to Redirect URLs. Retain localhost callbacks if still needed for development. This step needs Supabase dashboard access; hosting does not update it automatically.
3. Set Paystack TEST webhook to /api/paystack/webhook on that stable site. The application supplies /payments/callback using NEXT_PUBLIC_APP_URL.
4. Configure the secret-authenticated reconciliation worker every minute and operations maintenance every five minutes. Netlify Scheduled Functions have a 30-second execution limit, while these endpoints may need up to 60 seconds; use an appropriate background/scheduler arrangement. Do not put the Bearer secret into a URL. See docs/reliability-setup.md.
5. Keep backups, SMTP configuration, capacity monitoring and admin MFA in place. See docs/security-hardening-setup.md.

## Pilot checks

In an incognito browser: check homepage/catalog, sign in, recovery/confirmation callbacks, buyer/vendor access boundaries, admin MFA, photo upload and a clearly labelled Paystack TEST checkout. Read-only health must respond at /api/health; worker endpoints without credentials must return 401. Do not send real payments, refunds or payouts as smoke tests.

Monitor Netlify credit/usage limits during the pilot. A free plan can pause service at its allowance; do not enable automatic paid upgrades. Browser and financial-flow verification is required after deploying because build success alone does not prove hosting compatibility.
