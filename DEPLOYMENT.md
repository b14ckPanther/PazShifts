# Phase 11 — Deployment preparation (temporary Vercel domains)

This guide covers deployment preparation and subsequent manual updates. The user has supplied the worker domain `https://paz-shifts.vercel.app`; the latest changes still need deployment verification. Domain ownership or authorization from Paz is not confirmed. Preparation does not establish production or real-station pilot readiness. The user will push GitHub and create both Vercel projects manually; nothing in this guide requires deployment from the CLI.

## Step A — Push the repository to GitHub

From the repository root, review and commit the preparation changes, then push the existing `main` branch:

```sh
git status --short
git diff --check
git add -A
git diff --cached --stat
git commit -m "Prepare temporary Vercel deployment and NFC pilot configuration"
git push -u origin main
```

The configured remote is `https://github.com/b14ckPanther/PazShifts.git`. Review staged paths before committing. `.env.local`, build output, TypeScript caches, and local Vercel metadata are ignored. Never force-add environment files or paste credentials into Git. Use the real Supabase settings privately in Vercel; example files contain placeholders only.

## Step B — Create two Vercel projects

Import the same GitHub repository twice in the [Vercel dashboard](https://vercel.com/new). Select `main` as the production branch and Next.js as the framework. Project names are your choice.

## Step C — Configure roots and builds

| Setting                                     | Worker project                   | Admin project                    |
| ------------------------------------------- | -------------------------------- | -------------------------------- |
| Root Directory                              | `apps/web`                       | `apps/admin`                     |
| Framework                                   | Next.js                          | Next.js                          |
| Build Command (from project root)           | `pnpm build`                     | `pnpm build`                     |
| Install Command                             | `pnpm install --frozen-lockfile` | `pnpm install --frozen-lockfile` |
| Output Directory                            | Next.js default                  | Next.js default                  |
| Include source files outside Root Directory | Enabled                          | Enabled                          |

Use Node.js 24.x for both projects. Set `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the repository's `packageManager` pin (`pnpm@11.24.0`). Confirm the version in the first build log. The root `pnpm-workspace.yaml` and lockfile resolve `workspace:*` packages; both Next.js configs transpile the shared source packages. No separate package publishing or `vercel.json` is required. Root `pnpm build` runs both apps through Turborepo; each project-directory `pnpm build` runs only that app's `next build`.

These settings follow [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build) and [monorepo source access](https://vercel.com/docs/monorepos/monorepo-faq). A successful local build verifies repository resolution, not Vercel deployment.

Configure these variables in the **Production** environment:

| Variable                        | Worker                            | Admin                             |
| ------------------------------- | --------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Actual Supabase project URL       | Same project URL                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Actual anon/public key            | Same anon/public key              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Do not set                        | Actual secret, server-only        |
| `NEXT_PUBLIC_APP_URL`           | Actual worker origin after Step D | Actual worker origin after Step D |
| `NEXT_PUBLIC_ADMIN_URL`         | Actual admin origin after Step D  | Actual admin origin after Step D  |
| `ENABLE_EXPERIMENTAL_COREPACK`  | `1`                               | `1`                               |

Never prefix the service-role key with `NEXT_PUBLIC_`. It must not reach browser code. Local `.env.local` files are not uploaded by Git. If enabling Preview deployments, configure their environments deliberately; do not use arbitrary previews as physical tag destinations.

### Staff permissions migration

Before deploying the updated staff-management screens, apply `supabase/migrations/20260911000009_staff_permission_boundaries.sql` to the intended Supabase project after the preceding migrations. It limits station admins to workers and shift managers, prevents self-edits and physical membership deletion, and protects station identity while retaining operational settings. No existing memberships or attendance records are deleted or reassigned. This migration has been tested locally; that does not mean it has been applied to your hosted project.

Regression checks (repository root):

```sh
node --test tests/staff-actions.test.mjs
python3 tests/staff-permissions-db.py
```

The database test requires PostgreSQL binaries on PATH and creates/removes its own isolated local cluster. It never connects to Supabase. Deploy the code and migration together, then verify with separate super-admin and station-admin accounts.

## Step D — Deploy once to discover the real domains

Deploy each project with the Supabase variables and Corepack setting. Leave the two application-origin variables **unset** on this initial deployment if the domains are not known. Do not deploy example placeholders or local origins as production configuration.

Read each project's assigned production `.vercel.app` domain in Vercel. For example only, these might be `yellowshifts-web.vercel.app` and `yellowshifts-admin.vercel.app`; names are not guaranteed. Use stable project production domains, not a commit-specific preview URL.

At this stage, same-app login routing uses the actual request origin. Cross-app admin navigation and NFC URL copying show an unavailable/configuration message until their destination is configured. The admin origin cannot safely identify the separate worker origin. This first deployment is not pilot-ready.

## Step E — Set actual origins and redeploy both

Set the following on **both** projects, replacing the angle-bracket placeholders:

```dotenv
NEXT_PUBLIC_APP_URL=https://<actual-worker-vercel-domain>
NEXT_PUBLIC_ADMIN_URL=https://<actual-admin-vercel-domain>
```

Use HTTPS origins only, with no path, query, credentials, or fragment. A trailing slash is normalized. Redeploy both projects: Next.js public environment values are captured at build time. Verify the worker's admin link opens the actual admin project and the admin's NFC URL starts with the actual worker origin.

For local development only, both ignored `.env.local` files use:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
```

## Step F — Supabase Auth and deployed validation

After obtaining actual domains, open Supabase **Authentication > URL Configuration**:

- **Site URL**: `https://<actual-worker-vercel-domain>`.
- **Redirect URLs**: add both actual origins, plus `https://<actual-worker-vercel-domain>/**` and `https://<actual-admin-vercel-domain>/**` for application return paths. Replace every placeholder before saving; never allow all `*.vercel.app` domains.
- Keep `http://localhost:3000/**` and `http://localhost:3001/**` only if that Supabase project also serves local development.

Supabase's [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls) describes Site URL and allow-list matching. Current login uses email/password or phone/password and application redirects, rather than an OAuth callback. Worker and admin sessions are separate browser-origin sessions. Their login actions accept internal `next` paths, and middleware derives same-app redirects from the incoming request.

Verify on the deployed apps before writing the tag:

1. Worker login, logout, and station access work.
2. Admin login and role restrictions work.
3. A logged-out `/nfc/<station-token>` visit goes to `/login?next=...` on the worker origin and returns to the same NFC route after login.
4. External/protocol-relative `next` values do not redirect off-site.
5. Admin NFC copying produces exactly the worker-origin URL and the existing station token resolves correctly.
6. Required Supabase migrations and station memberships are present. Verify these separately; a build does not validate the deployed database.

## Step G — Authorized custom domains later

Only after Paz authorizes domain use, add the approved worker and admin custom domains to their respective Vercel projects and complete Vercel's DNS verification with the authorized domain administrator. Replace both origin variables on both projects, redeploy both, and update Supabase Site URL/redirect entries. No application architecture change is needed.

Rewrite the NFC tag with `<authorized-worker-origin>/nfc/<same-station-token>`. A domain change does not require token rotation. Keep the tag writable during the temporary-domain pilot; retain old-domain access while tags are being migrated if needed.

## NFC and physical pilot status

Before deployment, no physical NFC URL is verified or ready to write. After deployment, use `https://<actual-worker-vercel-domain>/nfc/<station-token>` copied from the admin portal. Check it matches the assigned worker domain before programming the tag. See [NFC_PILOT_CHECKLIST.md](NFC_PILOT_CHECKLIST.md).

| Item                       | Status                        |
| -------------------------- | ----------------------------- |
| NFC tag hardware available | YES (user has the card/tag)   |
| NFC URL ready to write     | PENDING ACTUAL DEPLOYMENT URL |
| NFC tag written            | PENDING USER                  |
| Physical phone scan        | PENDING USER                  |
| Clock-in/out physical test | PENDING USER                  |
| Real station pilot         | NOT READY                     |

Automated code, database, and route checks are separate from physical testing. This preparation does not claim a deployed application, a verified production redirect, a programmed tag, or a completed Phase 11 production deployment.

## Automatic NFC attendance and mobile PWA update

Apply `supabase/migrations/20260911000010_atomic_nfc_scans.sql` after the previous migrations, then deploy the updated worker app. This migration introduces atomic scan receipts and removes workers' direct attendance insert/update policies. The old button-based worker build must be replaced in the same release; otherwise its attendance writes will fail. Admin correction access is retained. No new secret environment variable is required.

The bare NFC URL stays the same. Middleware redirects each fresh opening to a unique receipt URL, preserved through login. The server validates the token, user, active membership and station, serializes scans per worker, and records clock-in using database time. With migration 11, an active shift requires a separate checkout confirmation; checkout time is the time of confirmation. Persistent receipts prevent replay; a 10-second duplicate window handles rapid rescans. Unprocessed visits expire after 15 minutes. Only eligible published shifts are linked.

The worker app includes a manifest, home-screen icons, safe-area-aware layouts and a service worker that caches only an offline help page. Authenticated pages and attendance writes are never cached or queued for later submission. See [Next.js PWA documentation](https://nextjs.org/docs/app/guides/progressive-web-apps). Check the live HTTPS manifest, icons and service worker after deployment. Static NFC URLs cannot distinguish a physical scan from opening a copied URL; no physical-presence guarantee is claimed.

Additional local regression checks:

```sh
node --test tests/nfc-flow.test.mjs
python3 tests/nfc-scans-db.py
```

See [NFC_PILOT_CHECKLIST.md](NFC_PILOT_CHECKLIST.md) for the updated manual acceptance sequence. Local browser/database tests do not mean the hosted migration, deployment, or physical pilot is complete.

## Worker profile editing, phone login, and checkout confirmation

Apply migrations `20260911000011_nfc_checkout_confirmation.sql` and `20260911000012_auth_profile_contact_sync.sql` in order, then deploy both apps. The former changes checkout to a pending receipt followed by confirm/cancel; the latter synchronizes Auth email, phone, and name changes into profiles atomically. Do not skip migration 12: profile updates depend on that trigger.

```sh
supabase db push --dry-run
supabase db push
supabase migration list
```

In Supabase Auth settings, ensure Phone authentication is enabled for phone/password sign-in. Users are created/updated by an authorized admin with their phone confirmed; the login flow calls `signInWithPassword`, never OTP or SMS. Keep public signup restricted according to your existing deployment policy. See [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords). The Phone provider was enabled on the linked hosted project on 2026-09-12, and the public Auth settings endpoint confirmed it. For any new Supabase project, enable Phone explicitly; database migrations do not enable providers. SMS confirmation, signup, and other provider settings were left unchanged.

Before enabling a worker's phone login, an admin must check the number belongs to that worker and save it under **צוות התחנה → עריכת פרטים**. Israeli local numbers such as `050-1234567` become `+972501234567`; other countries require a country code. Existing profile contact numbers are not automatically promoted into Auth credentials. Email and phone use the same password and the existing persistent session. A duplicate login identifier is rejected by Supabase Auth. No service-role credential is added to the worker app.

Editable worker details: name, email, phone, employee code, and optional replacement password. An empty password field preserves the current password. Role and station access use the existing controls; removing a worker ends station access while preserving attendance history. Station admins cannot edit their own permissions or credentials of admin accounts in other stations/platform accounts. Platform admins can edit station-admin accounts, but platform accounts remain protected here. Account identity is shared across stations, while employee code and access are station-specific.

Test both email/password and phone/password login on the hosted project, then physically scan to clock in, rescan and cancel checkout, and rescan and confirm checkout. Confirm that retry/refresh never ends a shift twice and that no checkout is possible from the ordinary worker home screen. These hosted and physical checks remain pending user verification.

## Admin layouts and scheduling-only shift managers

Apply `20260912000013_shift_manager_scheduling_scope.sql` and deploy the admin app together. The migration removes shift managers' team-attendance SELECT policy and permits publishing/reopening their station's schedules. Existing personal attendance/NFC access remains intact.

| Capability                                                         | Shift manager | Station admin                                   | Platform admin |
| ------------------------------------------------------------------ | ------------- | ----------------------------------------------- | -------------- |
| Build, assign, publish, reopen weekly schedules                    | Own station   | Own station                                     | All stations   |
| Archive schedules                                                  | No            | Own station                                     | All stations   |
| Team attendance, exceptions, lateness settings, NFC administration | No            | Own station                                     | All stations   |
| Staff management and shift templates                               | No            | Own station, with existing protected-role rules | All stations   |
| Create stations and appoint station admins                         | No            | No                                              | Yes            |

Shift managers enter a scheduling-only home. Direct attendance and exceptions URLs are rejected before loading dashboard data. Their own attendance records remain readable for their personal worker flow; they cannot read coworkers' attendance through the database API. Suspended station admins are denied administrative actions. Phones and tablets use the day schedule view; the weekly grid remains available on wide screens.

Verification: `node --test tests/*.test.mjs` and `python3 tests/staff-permissions-db.py` cover publishing/reopening, archive denial, cross-station denial, attendance isolation, and admin-only settings. Browser checks cover 320, 375, 430, 768 and 1280 pixel widths; physical Safari verification remains a manual post-deployment check.

## Login switcher and branded startup

The worker login defaults to Phone; admin login defaults to Email. The animated switch preserves each identifier and the shared password. Phone uses the telephone keyboard, email uses the email keyboard, and both authenticate with the same password. Israeli local numbers are normalized before password authentication. A disabled Phone provider now produces a clear message directing the user to Email instead of incorrectly reporting a bad password.

Both apps use the existing YellowShifts artwork for the startup and route-loading screens. The startup animation runs for at most 1.1 seconds once per browser tab/session, dismisses on interaction, and never intercepts input or delays an auth/NFC request. Direct NFC routes skip it. Reduced-motion users skip the startup animation and receive static route-loading artwork. This is an in-app entrance; the operating system controls its native PWA launch screen.

No new database migration is required for this login/splash update. Deploy both apps to receive the UI changes. Verify phone/password with an actual worker account on the hosted app, including a return NFC scan in the same browser session; automated UI checks do not substitute for a physical phone test.

## Station manager dashboard and manual attendance

Station admins now land on `/stations/<their-station-id>`, the same station operations dashboard used by platform admins. It exposes weekly schedules, live attendance, staff, attendance exceptions/tolerances and shift templates. Station creation, station identity changes and appointment of station admins remain platform-only. Shift managers retain their scheduling-only management workspace.

Apply `20260912000014_manual_attendance.sql` before deploying the admin update:

```bash
supabase db push --dry-run
supabase db push
```

The migration adds `save_manual_attendance` and a read-only audit table for manual edits. Station admins and platform admins can add missed attendance or edit existing check-in/check-out times for station members, including themselves. An empty checkout means the shift is still active. Every manual save requires a reason and records the actor, previous values and new values. Times are interpreted in the station timezone, future/reversed/overlapping intervals are rejected, and stale records must be reopened before editing. Manual operations serialize with NFC scans. No migration was applied remotely as part of this code change.

The attendance screen fetches fresh records every 15 seconds while visible and on returning to the tab, with a manual refresh button and an error indicator when refreshing fails. Its history tab shows the latest 50 completed/flagged records (not just today). The manual form includes station managers in the member selector; editing one's attendance does not grant permission to remove one's membership or change one's role.

After applying the migration and deploying, verify with a station-admin account: open weekly scheduling; publish/reopen a schedule; observe a worker's NFC check-in in attendance; correct both times with a reason; add a missed self attendance record; confirm that a shift-manager account still cannot manage attendance. Physical NFC and iPhone checks remain user verification steps.
