# CampusMart

A campus marketplace built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase and Zustand.

## Development

Use Node.js 24 and run these commands from the project root:

```powershell
npm.cmd install
npm.cmd run dev
```

Create `.env.local` from `.env.example` and supply the Supabase project URL and public anonymous key. Keep service-role and payment keys on the server; never expose them through NEXT_PUBLIC variables.

The application uses src/app route groups for the store, authentication, checkout and vendor area, plus a separate admin area. Shared listing rules and fee displays live in src/lib.

## Buyer features and database setup

Read [the buyer implementation notes](docs/BUYER_FEATURES.md) for the feature list, required migration, authentication configuration and remaining launch work.

The new buyer features require [this migration](supabase/migrations/202610310001_buyer_features.sql) on the EXISTING CampusMart Supabase database. The user confirmed that this first migration was applied successfully. [The follow-up fixes](docs/BUG_FIXES_2026-10-31.md) require a separate second migration for vendor enrollment and image cleanup. Older database definitions from previous sessions are not yet captured in this repository.

**Online checkout is intentionally gated until real payment initialization and verified webhooks are connected.** The app does not simulate successful payments or charge buyers.

## Checks

```powershell
npm.cmd test
npm.cmd run lint:buyer
npm.cmd run test:e2e
npm.cmd run build
```

Browser tests use installed Google Chrome, local fixture data and separate ports/build output. They do not contact the live Supabase project. Build-time Google Fonts downloads need network access. The full `npm.cmd run lint` also includes existing vendor code outside the buyer implementation.

See [the implementation notes](docs/BUYER_FEATURES.md) for what each check covers and the limits of fixture testing.
