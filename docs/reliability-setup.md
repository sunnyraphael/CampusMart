# Reliability and capacity setup

The code changes prepare CampusMart for a controlled launch; they do not establish a visitor capacity guarantee. No live SQL, payments, emails, backup exports or remote load tests were run during implementation. External accounts and schedules must be configured by the operator.

## Apply the database migration

Back up the project first. Apply `supabase/migrations/202611020002_reliability.sql` after store-management migration `202611020001`. It adds private operational telemetry/settings, capacity guards, action limits, query indexes, bounded dashboard aggregates, inbox pagination and thumbnail-aware cleanup. It does not delete orders, messages, reviews, payment records or private verification documents.

Storage bucket configuration changes apply to **new** public uploads: JPEG/PNG/WebP, maximum 1 MiB per stored file. Existing files remain readable. New listing uploads automatically produce a WebP original (maximum dimension 1600px, target about 300 KB) and a 640px thumbnail (target about 90 KB). A quality floor can produce a larger file, up to the 1 MiB cap. Logos use smaller variants. The browser removes EXIF metadata through canvas encoding. Private verification documents keep their separate upload process and readability limits.

Large HEIC/GIF/SVG images must be converted to JPG, PNG or WebP first. Legacy listing photos keep working at their existing sizes. Re-uploading through the editor creates optimised variants; no bulk rewrite of existing customer files was performed. New URLs are unique and immutable. Public images have long browser caching; copied/cached public images can outlive deletion from the origin. Private KYC files are never made public or passed through the public thumbnail helper.

The storage insert policy enforces a shared safety margin at 90% of the configured file-storage limit and limits new uploads to 120 stored objects per folder/bucket per hour. Each listing photo uses two objects. This is a safety measure, not a reservation or a promise that all concurrent uploads will fit. Set the capacity limits to match your actual Supabase plan. Do not bypass the policy to solve a capacity problem.

## Monitor the service

Open **Admin → System health** and choose **Check capacity**. Database bytes, Storage metadata bytes, file count and pending jobs are sampled. Warnings appear at 70% and critical alerts at 85% of configured allowances. The admin header checks for alerts while visible, approximately once a minute.

Monthly cached/uncached egress is **not guessed**. Copy current-billing-cycle usage from Supabase into the settings and update its measurement when checking usage. Database size is not physical disk usage; check Supabase's disk, CPU and query-performance reports separately. Defaults reflect a conservative Free-plan allowance. Change the limits when upgrading; this screen does not automatically detect your subscription or replace Supabase's billing reports.

These measurements cover this project. If your Supabase organisation shares an allowance across several projects, account for their usage too and configure a smaller allocation for CampusMart. Database and file exports are taken separately; recovery drills should check that restored database references match the available file snapshot.

The **Temporarily stop new orders** control blocks new checkout in the UI, server actions and a database trigger. It preserves carts and permits existing order updates, payment callbacks, refunds and transfers. Turn it off after resolving the incident. A server-verified payment remains authoritative; cached catalog/category data never substitutes for checkout price or stock checks.

Public uptime endpoint: `GET /api/health`. It returns only `ok` or `unavailable` and checks a lightweight database RPC. Configure an external uptime monitor to check it every 1–5 minutes and notify your chosen email/phone. A successful ping does not prove email, payment-provider or backup readiness. Use the monitor's private configuration for notifications; no recipient was contacted during this work.

## Schedule two separate workers

Both requests need `Authorization: Bearer <CRON_SECRET>` with the server-only secret from your environment. Never put the secret in a URL.

| Worker | Suggested schedule | Purpose |
| --- | --- | --- |
| `GET /api/payments/reconcile` | Every minute | Verify pending charges, expire reservations and reconcile existing refund/transfer jobs. |
| `GET /api/operations/maintenance` | Every five minutes | Queue public orphan images older than 48 hours, remove up to five safely claimed files and sample capacity. |

Allow up to 60 seconds for each invocation and monitor HTTP failures, stale samples and queue growth. The operations endpoint returns HTTP 503 for critical capacity alerts as well as cleanup failures, so a scheduler or protected HTTP monitor can notify you before the service runs out of capacity. Configure deduplicated notifications on that external service. Increase maintenance frequency if the image queue grows; do not increase deletion batches blindly. Active listing photos, their thumbnails, store logos still in use and private KYC documents are excluded. Leases and tombstones protect retry/race cases. A failed deletion stays queued. Invalid or foreign URLs remain for administrator review rather than being fetched/deleted.

Local/manual helpers:

```powershell
node --env-file=.env.local scripts/reconcile-payments.mjs
node --env-file=.env.local scripts/maintenance.mjs
```

The host/scheduler is not connected by adding these files. Set its schedules and secrets on the deployed HTTPS site. An always-on cloud runner is preferable to a laptop that may sleep.

## Authentication email and abuse protection

Configure your selected SMTP provider in **Supabase Authentication email/SMTP settings**. Use a sender domain you control, complete that provider's SPF/DKIM configuration, review DMARC, and test confirmation and password reset with an external mailbox. Check the configured email rate limits. Do not turn off email verification merely to work around delivery errors. SMTP credentials belong in Supabase/provider settings, not browser environment variables.

Optional authentication challenge:

1. Create a Cloudflare Turnstile widget for your staging/production domains using managed interaction behavior.
2. Enable Turnstile CAPTCHA in Supabase Auth with the matching secret.
3. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to its public site key and rebuild. Do not add the secret with a public prefix.
4. Test successful login, registration, expired challenges and recovery. Remove the public site key if the feature has not been configured in Supabase; the application does not treat a client-only widget as server protection.

The script loads only on the requested authentication forms when configured. The widget uses interaction-only appearance; suspicious requests may need additional interaction. Supabase validates tokens server-side. Application database limits additionally cover support requests, new conversations and saved searches. Existing message/checkout limits remain in place. These are layered protections, not a DDoS guarantee; configure hosting/provider protections and monitor misuse before a large launch.

## Encrypted backups

Install compatible PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`) on a trusted backup runner. Use a client version compatible with your database server; do not assume the system-default version is sufficient. PostgreSQL tools were not installed during implementation, so an actual database export/restore remains a setup step.

Use a separate ignored file such as `.env.backup.local`:

Remote database connections default to `sslmode=verify-full`. Configure `PGSSLROOTCERT` with the trusted certificate required by your Supabase database connection. Keep hostname verification enabled; install the appropriate certificate rather than disabling TLS verification to make a backup succeed.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only key>
BACKUP_DATABASE_URL=<direct or session PostgreSQL connection URL>
BACKUP_ENCRYPTION_KEY=<64 random hexadecimal characters>
BACKUP_DIR=backups
```

Generate the encryption key locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep a separate secure copy; losing the key makes the backup unreadable. Do not paste keys or database URLs into chat. Private files are encrypted with authenticated AES-256-GCM. Keys are not included in the archives. Backups are excluded from Git and cannot be placed under `public` or `src` by this tool.

```powershell
node --env-file=.env.backup.local scripts/backup.mjs database
node --env-file=.env.backup.local scripts/backup.mjs storage
node --env-file=.env.backup.local scripts/backup.mjs verify-database
node --env-file=.env.backup.local scripts/backup.mjs verify-storage
```

Database backups stream directly into encryption. File backups create encrypted manifests and reuse unchanged encrypted objects from the preceding snapshot; the first run downloads all files. Listing metadata still uses API requests, and changed-file/database downloads consume egress. Plan the frequency and bandwidth; a daily full database dump near the Free-plan limit can itself exceed monthly egress. Suggested starting schedule: daily database backups while small and daily incremental file snapshots, adjusted to measured usage and recovery needs.

Copy the encrypted manifests **and the complete referenced `objects` folder** to an access-controlled off-site destination you choose. Off-site storage credentials and scheduling were not configured. Do not copy only the `latest-*` pointer. Maintain a documented retention/deletion policy for backups, particularly private verification files and completed deletion requests. Old backup versions are not automatically erased by this script.

### Test recovery

Archive verification checks authentication/integrity, not successful restoration. On a compatible local PostgreSQL installation, create an empty disposable database named `campusmart_restore_<suffix>` with the required Supabase roles/extensions. Set `BACKUP_RESTORE_DATABASE_URL` to that **localhost** target and run:

```powershell
node --env-file=.env.backup.local scripts/backup.mjs restore-test --confirm-empty-local
```

The tool refuses a remote target, an unrelated database name or a non-empty target. A failed restore can leave partial objects in this disposable database; start with a fresh empty target before retrying. Check restored rows, policies and application behavior manually afterward. It never restores over production.

To decrypt a small sample of Storage files locally:

```powershell
node --env-file=.env.backup.local scripts/backup.mjs restore-storage-test --confirm-private-local
```

This explicitly creates plaintext sample files under the backup folder; inspect them and securely remove them afterward. It does not upload files to Supabase. Verify coverage of both public photos and private documents, and perform a full isolated staging recovery before declaring the disaster-recovery process ready. Keep your keys and restored files access-controlled.

## Readiness and load testing

```powershell
node --env-file=.env.local scripts/readiness.mjs
```

The report never prints secret values. `--check-http` checks the configured health URL. Optional `--check-auth-remote` uses **local** `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` to read SMTP configuration through the Management API; it does not send email or change settings. A configured SMTP host is not evidence of delivery. Readiness failures remain visible until external setup is complete.

```powershell
$env:LOAD_TEST_BASE_URL='http://127.0.0.1:3101'
$env:LOAD_TEST_SECONDS='30'
$env:LOAD_TEST_RPS='5'
$env:LOAD_TEST_CONCURRENCY='5'
node scripts/load-test.mjs
```

Use your own local/staging site. Non-local targets require explicit `LOAD_TEST_ALLOW_STAGING=1`. Start low and increase gradually. The tool caps concurrency/RPS/duration and reports error percentage and p50/p95/p99 latency. It performs public GET requests only, unless `LOAD_TEST_INCLUDE_ACCOUNT=1` and a dedicated staging `LOAD_TEST_COOKIE` are provided locally. Authenticated GET coverage includes messages, orders and checkout. Cookies must remain private. No accounts, orders, messages, charges or transfers are created by the load script.

This tests HTML/backend response behavior, not real-device scrolling, image bandwidth, simultaneous message sends or payment-provider capacity. Combine it with the browser workflow tests and a staged pilot. Define acceptable latency/error thresholds for your audience, check database resource reports during the test and stop if errors rise. No safe production capacity is claimed from fixture tests.

## User experience and remaining deployment work

Catalog, vendor listing and inbox pages use bounded batches. Vendor dashboard/pending-earnings totals are computed in SQL across qualifying real orders rather than truncated client downloads. Public category labels are cached briefly through an anonymous request; prices, stock, personal pages and financial decisions are not shared-cached. Message refreshes request recent changes while visible/online, avoid overlapping polls and pause when hidden. Error screens, cart preservation, payment verification, explicit refund amounts and no-double-payment recovery remain in place.

Before real payments: deploy HTTPS, apply migrations, configure both workers, enable reliable email, establish off-site backups and complete restoration drills, test Paystack against your own staging account, and validate actual provider business eligibility. Upgrading Supabase does not by itself complete these steps or guarantee uptime.
