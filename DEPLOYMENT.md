# Deployment

YellowShifts is part of [Darb](https://darb.co.il). The two web apps are deployed as separate Vercel projects from this repository:

| App    | Domain                         | Vercel root directory |
| ------ | ------------------------------ | --------------------- |
| Worker | `https://paz.darb.co.il`       | `apps/web`            |
| Admin  | `https://admin.paz.darb.co.il` | `apps/admin`          |

## Production origins

In **both Vercel projects**, set Production variables:

```dotenv
NEXT_PUBLIC_APP_URL=https://paz.darb.co.il
NEXT_PUBLIC_ADMIN_URL=https://admin.paz.darb.co.il
```

In the **admin project**, optionally set:

```dotenv
NEXT_PUBLIC_NFC_APP_URL=https://paz.darb.co.il
```

Redeploy both projects after changing environment variables; Next.js captures public values at build time. The optional NFC origin only controls the admin's displayed/copied tag URL; when omitted it uses the worker origin. An invalid configured origin disables the link. It does not redirect scans, rotate tokens, or change attendance behavior. App navigation stays relative to the host being used. Local ignored `.env.local` files remain local-only.

Supabase Authentication → URL Configuration:

- Site URL: `https://paz.darb.co.il`.
- Allow the origins and return paths for `https://paz.darb.co.il/**` and `https://admin.paz.darb.co.il/**`. Never allow arbitrary Vercel projects.
- Keep `http://localhost:3000/**` and `http://localhost:3001/**` only if that Supabase project also serves local development.

Browser sessions and installed PWAs are host-scoped, and no credentials or cookies are shared between the worker and admin domains. Install the worker PWA from `https://paz.darb.co.il`.

NFC tags hold `https://paz.darb.co.il/nfc/<station-token>`, copied from the station's attendance page in admin. The token is a credential and is never committed. Changing the domain does not require token rotation; rotating a token invalidates the old URL and the tag must be rewritten. See [NFC_PILOT_CHECKLIST.md](NFC_PILOT_CHECKLIST.md).

## Step A — Repository

Both projects deploy the `main` branch of this repository. `.env.local`, build output, TypeScript caches and local Vercel metadata are ignored. Never commit environment files or credentials; configure real Supabase settings privately in Vercel. Example files contain placeholders only.

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

| Variable                                                                                   | Worker                         | Admin                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------ | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                                                 | Actual Supabase project URL    | Same project URL                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                            | Actual anon/public key         | Same anon/public key                            |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                | Do not set                     | Actual secret, server-only                      |
| `NEXT_PUBLIC_APP_URL`                                                                      | `https://paz.darb.co.il`       | `https://paz.darb.co.il`                        |
| `NEXT_PUBLIC_ADMIN_URL`                                                                    | `https://admin.paz.darb.co.il` | `https://admin.paz.darb.co.il`                  |
| `ENABLE_EXPERIMENTAL_COREPACK`                                                             | `1`                            | `1`                                             |
| `NEXT_PUBLIC_NFC_APP_URL`                                                                  | Do not set                     | Optional, see Production origins                |
| `APPLE_APP_IDS`, `ANDROID_APP_LINKS_PACKAGE`, `ANDROID_APP_LINKS_SHA256`                   | Native app links, see below    | Do not set                                      |
| `NOTIFICATIONS_ENABLED`, `NOTIFICATIONS_CRON_SECRET`, `EXPO_ACCESS_TOKEN` (optional)       | Do not set                     | Push dispatcher, server-only, see below         |
| `STATION_LEADS_RATE_SECRET`, `STATION_LEADS_EMAIL`, `STATION_LEADS_FROM`, `RESEND_API_KEY` | Do not set                     | Station-interest intake, server-only, see below |

The last three rows belong to features added after this preparation; leave them unset until that feature is rolled out. `turbo.json` declares the server-only variables under `tasks.build.env`; add any new server variable there too.

Never prefix the service-role key with `NEXT_PUBLIC_`. It must not reach browser code. Local `.env.local` files are not uploaded by Git. If enabling Preview deployments, configure their environments deliberately; do not use arbitrary previews as physical tag destinations.

### Staff permissions migration

Before deploying the updated staff-management screens, apply `supabase/migrations/20260911000009_staff_permission_boundaries.sql` to the intended Supabase project after the preceding migrations. It limits station admins to workers and shift managers, prevents self-edits and physical membership deletion, and protects station identity while retaining operational settings. No existing memberships or attendance records are deleted or reassigned. This migration has been tested locally; that does not mean it has been applied to your hosted project.

Regression checks (repository root):

```sh
node --test tests/staff-actions.test.mjs
python3 tests/staff-permissions-db.py
```

The database test requires PostgreSQL binaries on PATH and creates/removes its own isolated local cluster. It never connects to Supabase. Deploy the code and migration together, then verify with separate super-admin and station-admin accounts.

## Step D — Domains and origins

Add `paz.darb.co.il` to the worker project and `admin.paz.darb.co.il` to the admin project, and complete Vercel's DNS verification for `darb.co.il`. Set the origin variables from [Production origins](#production-origins) on both projects and redeploy both. Use HTTPS origins only, with no path, query, credentials or fragment; a trailing slash is normalized.

For local development only, both ignored `.env.local` files use:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
```

## Step E — Supabase Auth and deployed validation

Configure Supabase Authentication as described in [Production origins](#production-origins). Supabase's [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls) describes Site URL and allow-list matching. Login uses phone/password (email/password remains supported) and application redirects rather than an OAuth callback. Worker and admin sessions are separate browser-origin sessions. Their login actions accept internal `next` paths, and middleware derives same-app redirects from the incoming request.

Verify on the deployed apps before writing a tag:

1. Worker login, logout, and station access work.
2. Admin login and role restrictions work.
3. A logged-out `/nfc/<station-token>` visit goes to `/login?next=...` on the worker origin and returns to the same NFC route after login.
4. External/protocol-relative `next` values do not redirect off-site.
5. Admin NFC copying produces exactly the worker-origin URL and the station token resolves correctly.
6. Required Supabase migrations and station memberships are present. Verify these separately; a build does not validate the deployed database.

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

Both worker and admin login default to Phone (shared `CompactLogin`). The animated switch preserves each identifier and the shared password. Phone uses the telephone keyboard, email uses the email keyboard, and both authenticate with the same password. Israeli local numbers are normalized before password authentication. A disabled Phone provider now produces a clear message directing the user to Email instead of incorrectly reporting a bad password.

Both apps use the existing YellowShifts artwork for the startup and route-loading screens. The startup reveal (`LaunchIntro`) plays for about 1.15 seconds once per browser tab/standalone PWA session (sessionStorage). It covers the page while the app hydrates underneath and is not dismissed by interaction; it does not delay an auth/NFC request. Direct NFC routes and logins returning to an NFC route skip it. Reduced-motion users get a short fade instead. The worker app also shows a branded splash on same-origin navigation, back/forward and login submit (not NFC routes): at least 1 second, held until route-loading/pending indicators clear, and it blocks input while visible. Admin uses skeleton route-loading instead. This is an in-app entrance; the operating system controls its native PWA launch screen.

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

## Installed PWA frame and mobile navigation

Both projects now publish their own `/manifest.webmanifest`, Apple web-app metadata and offline-only service worker. The admin manifest, service worker and offline document are publicly accessible without a login redirect. Both apps use a white browser theme with dark system controls, light content surfaces, yellow active navigation and crimson primary actions. Safe-area padding protects the status area, landscape cutouts and home indicator; compact mobile headers reduce repeated chrome.

Worker bottom navigation links to shifts and availability while preserving the selected station. It is absent from login and NFC receipt screens. Within a station, admins get overview, schedule, attendance and staff shortcuts; shift managers get station selection and scheduling only. Links use client navigation and show the current section. The dock hides during text entry and is not shown on desktop. Existing server/database permissions still enforce access.

After deploying both apps, open each actual deployment URL in Safari, use Share → Add to Home Screen, and enable Open as Web App if offered. Launch from the Home Screen icon. If an older admin shortcut still opens with an address bar, remove that shortcut and add the updated site again. Removing an installed app may require signing in again. A browser or in-app browser controls its own address bar and toolbar; CSS cannot remove those controls. The installed worker and admin remain separate origins and can have separate login sessions.

Verify on an actual iPhone in portrait and landscape: status/home areas stay clear, the final page controls scroll above the dock, text entry remains usable, and NFC confirmation controls remain unobstructed. Desktop Chromium checks with simulated safe-area values do not verify iOS system rendering. No new database migration is required for these PWA changes.

## Navigation performance

Auth context now runs the independent profile, role and membership reads concurrently. Page/layout reads use React's request-scoped `cache` through each app's `getServerContext`; it does not persist authorization between requests or share data between users. Mutating server actions continue checking authorization freshly. Weekly schedules embed their shifts/assignments in one database read; active/history attendance reads run concurrently.

Station overview no longer downloads the full staff directory and account editor. These remain available under the Staff tab. Station routes have a loading boundary inside the persistent station layout, so the dock stays usable and Next can prefetch the loading shell. Ordinary admin navigation uses lightweight placeholders; the worker app now replays its branded navigation splash (see above). Navigation links show pending feedback immediately; NFC routes are excluded from the new link wrapper and retain their scan/receipt handling. No authenticated page data is added to the service-worker cache.

Validation on 2026-09-12: three alternating reads against the same hosted project measured auth-context medians of 784 ms before and 293 ms after. This measures that server-data step from the development machine, not end-to-end Vercel or iPhone navigation. The joined schedule query returned identical data to the previous implementation for a hosted six-shift schedule. No new migration or Vercel configuration is needed; deploy both apps and verify tab response on a physical phone.

Later changes (2026-09-24/25) alter this: auth context and the admin schedule workspace now use single-round-trip RPCs from migration 25, and middleware skips the Supabase Auth call when a session cookie is still valid. See [Performance RPCs and middleware fast path — migration 25](#performance-rpcs-and-middleware-fast-path--migration-25).

## Stop or remove mistaken attendance (migration 16)

Apply `20260912000016_attendance_removal.sql` before deploying the admin attendance actions. It adds authenticated station-admin/platform-admin `CLOSE` and `DELETE` operations with a required reason, stale-record checks and the same per-worker lock as NFC/manual attendance. No existing attendance is removed by applying the migration.

```sh
supabase db push --dry-run
supabase db push
```

On active attendance, choose **סיום משמרת** to close at database time, or **מחיקת דיווח שגוי** to remove a mistaken entry. Recent completed records can also be removed. Confirm the worker and supply a reason. Use the existing time editor for a specific checkout time. Removal frees the overlap interval and excludes the row from worker/admin reports after refresh. Workers and shift managers cannot perform these operations.

Deletion preserves the original snapshot/actor/reason in the RLS-protected `attendance_removals` table and existing manual audit entries. NFC receipts retain original identifiers as replay tombstones: replaying a deleted record returns a stale-checkout error, never a new attendance write. A new scan can start a new shift. No physical attendance/security checks were relaxed. There is no restore button; an administrator can enter a corrected report afterward.

This transactional migration briefly locks the audit and receipt tables when replacing their foreign-key enforcement with retained historical identifiers. Apply during a quiet period. Deployment rollback can revert the UI while leaving migration 16 in place. Do not blindly re-add the old foreign keys after removals: archived identifiers intentionally no longer exist in attendance. Restoring those constraints requires a reviewed data restoration/archival plan. Never delete receipt tombstones to resolve a constraint error.

Local verification includes authorization, stale edits, audit retention, same-range replacement after deletion, old-scan replay denial, and existing NFC concurrency tests. Hosted migration/application and physical phone verification remain owner actions. Shared loading buttons now retain their geometry and the staff dialog uses a dim backdrop without blur; deploy both apps for shared-button updates.

## Admin reload recovery

The admin error page's retry button now reloads the current document once on user request, creating a fresh server render instead of resetting the same failed React boundary. It shows a pending state; there is no automatic reload loop. Admin authentication redirects also copy refreshed/cleared session cookies onto the redirect response.

The shared server Supabase client retries a same-origin PostgREST table/view GET once after 150 ms for transport TypeError or HTTP 502/503/504. Auth endpoints, RPC endpoints (including GET RPC), mutations, permission errors, and other errors are not retried. Persistent failures still surface. No cached private data or authorization bypass is introduced. Both apps should be rebuilt/deployed; no migration or environment changes are required.

Local regression checks cover refreshed redirect cookies, transient/persistent read failures, cancelled requests and mutation/RPC exclusions. The original hosted exception corresponding to support digest `1393664799` has not been identified from server logs; the digest alone is insufficient to establish its cause. If it recurs after deployment, correlate the digest and request time with Vercel function logs. Do not log sessions, employee records or credentials when investigating.

### Readable admin station URLs

Admin station pages now use the station's existing unique code, for example
`/stations/KURDANI` and `/stations/KIRYAT-ATA/reports`. Codes are case-sensitive.
The signed-in Supabase client resolves the code under RLS, then Next.js rewrites
it internally to the existing UUID route. Page and mutation authorization remain
unchanged. No schema migration or environment variable is required.

Existing UUID GET links temporarily redirect (307) to the current code, retaining
subroutes and query parameters. UUID POST requests are not redirected; code POST
requests rewrite to the same internal action route. Refreshed session cookies
are copied to redirects and rewrites. Since 2026-09-24 middleware keeps an
in-memory `id`/`code` map per server instance for 30 minutes, shared across users;
it holds no permissions, and pages still authorize every request. A cache miss adds
one small authorized `id, code` read; legacy links also incur a redirect. Station-list,
dock and station-page links use codes directly.

Deploy the admin app. Verify station switching, nested reports/schedules, login
return URLs, and a normal save with an authorized test account. Local middleware
contract tests cover resolution, missing/denied stations, cookies and POST handling;
hosted authenticated browser behavior remains owner verification. Changing a
station code changes its readable URL; old UUID links remain valid. A warm instance
may still resolve the old code for up to 30 minutes. Revert this
change and redeploy to restore UUID-only routing.

### Readable worker station URLs

Worker station links use `/stations/KURDANI`, `/stations/KURDANI/home`,
`/stations/KURDANI/availability`, and `/stations/KURDANI/hours`. Existing `stationId`
query links (`/`, `/home`, `/hours`, `/availability`) redirect to the code path on
GET/HEAD, keeping week/date filters. The root `/` still selects the user's usual
station; a signed-in visit to `/login` without `next` goes to `/home`. Code routes
rewrite internally to the existing worker pages with the resolved UUID; server-side
membership checks and mutations remain unchanged. The resolver uses the signed-in
RLS client; since 2026-09-24 the `id`/`code` mapping is cached in memory per
server instance for 30 minutes, as in admin. A cache miss adds one `id, code` lookup.

NFC `/nfc/<token>` routes and their scan receipts are unchanged: do not rewrite the
physical tag. Legacy POST targets are retained, while code-path POSTs rewrite
without a redirect. Deploy the worker app; no SQL or environment changes are
required. Local contract tests cover all three routes, filters, login return,
missing stations, cookie refresh, and POST handling. Verify signed-in navigation,
station switching, and an availability save after deployment. Revert the worker
routing change and redeploy to restore query-only URLs.

### Station location enforcement — migration 17

Apply `20260912000017_station_geofence.sql` and deploy **both apps** in a coordinated
maintenance window. Old clients without coordinates cannot clock in/out after this
migration; reload the worker app after deployment. New clients against the old DB
also fail closed. Do not leave mismatched deployments active.

The migration sets the pilot station's location:

| Code       | Latitude  | Longitude | Radius |
| ---------- | --------- | --------- | ------ |
| KURDANI    | 32.858784 | 35.090755 | 50 m   |
| KIRYAT-ATA | 32.804492 | 35.075356 | 50 m   |

Other existing stations without coordinates cannot report NFC attendance until
configured. New station creation requires coordinates. Station and platform admins
can edit coordinates and a 30–200 m radius under station settings; shift managers
and workers cannot. The 50 m default needs physical testing at the tag location.
Coordinates identify the center of the fence, not the property's boundary.

Check-in and confirmed checkout enforce distance in the atomic database RPC, under
the existing worker lock and membership checks. A fresh location (up to 60 seconds,
10-second future clock tolerance) is required, with reported accuracy no worse
than the radius. Accuracy does not enlarge the fence. Cancellation and completed
receipt replay do not create attendance and remain possible without a location
check in the RPC. Server timestamps, replay protection and manual admin correction
remain unchanged. The old no-location RPC cannot perform attendance mutations.

Browser location requires permission and HTTPS on either worker domain. Denied,
unavailable, timeout, stale, inaccurate and outside readings show retry guidance;
no attendance success is displayed before server confirmation. Worker coordinates
are not persisted or logged by this feature. Browser-supplied coordinates can be
spoofed: this is a deterrent to casual remote use, not proof of physical presence.
No background tracking is introduced. NFC URLs/tokens and old-host compatibility
are unchanged; the physical tag does not need rewriting for this upgrade.

Manual rollout:

```sh
supabase db push --dry-run
supabase db push
```

Review the dry run for other pending migrations first. Then deploy both apps and
verify each station location/radius in admin. Physically test inside/outside the
fence, denied permission, an inaccurate reading, checkout confirmation and retry.
These physical checks have not been performed by the agent.

Local verification covers full migrations, distance boundaries around 50 m, missing/
invalid/stale/inaccurate readings, missing-coordinate creation denial, denied remote
checkout, old-RPC bypass denial, configuration permissions, cancellation/replay,
concurrent checkout, isolation and manual attendance corrections.

DDL briefly locks the stations table and replaces the NFC function signature.
Rollback requires a coordinated database/app rollback: restore the four-argument
RPC from migration 16 and the three-argument wrapper from migration 11, remove the
new eight-argument RPC and location-required trigger, then redeploy the prior app.
This removes geofence protection; do not do it as a silent workaround. Location
columns may remain for recovery. No new environment variables or paid service.

### Native NFC links (Mobile Phase 7)

The worker project now serves `/.well-known/apple-app-site-association` and
`/.well-known/assetlinks.json` without authentication. Configure `APPLE_APP_IDS`,
`ANDROID_APP_LINKS_PACKAGE`, and `ANDROID_APP_LINKS_SHA256` from the actual signed
app identities; missing values intentionally return 503. `paz.darb.co.il` must serve the
documents directly, without a redirect.

Apply the reviewed native NFC and left-open notification migrations (20 and 21)
before releasing the new native attendance build. No production migration or
association deployment was performed during implementation. Signing, environment
values, inspection/apply commands, rollback and physical-device checks are in
[`apps/mobile/PHASE7.md`](apps/mobile/PHASE7.md).

The worker middleware also leaves `/privacy/yellowshifts`, `/support/yellowshifts`
and the Heebo font files public (privacy and support pages for the YellowShifts
mobile app).

### Migrations 18–23 (mobile phases)

Migrations 18, 19, 22 and 23 also affect the web apps. Their rollout notes live
beside the feature:

| Migration                                   | Affects                                  | Notes                                                                      |
| ------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| `20260913000018_atomic_worker_availability` | Worker web and mobile availability saves | Apply before the web caller; [PHASE3](apps/mobile/PHASE3.md)               |
| `20260913000019_worker_notifications`       | Device/inbox tables, publication trigger | [PHASE5](apps/mobile/PHASE5.md)                                            |
| `20260913000020/21` native NFC, left-open   | Native attendance, reminders             | [PHASE7](apps/mobile/PHASE7.md)                                            |
| `20260913000022_sunday_calendar_weeks`      | Admin, worker web and mobile week keys   | Maintenance window, preflight; [SUNDAY-WEEKS](scripts/sql/SUNDAY-WEEKS.md) |
| `20260914000023_notification_station_time`  | Reminder timing in station time          | [PHASE9](apps/mobile/PHASE9.md)                                            |

`apps/mobile/PHASE9.md` records migrations 1–23 as matching the linked project on
2026-09-14. Hosted state of 24 and 25 has not been verified here.

### Push notification dispatcher (admin)

The admin project serves `POST /api/internal/notifications`. Middleware exempts
this exact path; the route requires `Authorization: Bearer <NOTIFICATIONS_CRON_SECRET>`
(401 otherwise), returns `{enabled:false}` unless `NOTIFICATIONS_ENABLED=true`, and
503 without `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. It uses the
service-role key server-side. `EXPO_ACCESS_TOKEN` is only needed if Expo enhanced
push security is enabled. Set these on the admin project only and redeploy.

Supabase `pg_cron` + `pg_net` call the route every minute; there is no Vercel Cron.
The same secret must be stored in Supabase Vault as
`yellowshifts_notifications_cron_secret`. The job is created by
`scripts/sql/notification-scheduler.sql` (a production operation, not a migration),
which targets `https://admin.paz.darb.co.il`. Setup, pause, monitoring and the
2026-09-15 activation record are in
[`scripts/sql/NOTIFICATION-SCHEDULER.md`](scripts/sql/NOTIFICATION-SCHEDULER.md).

### Station-interest intake — migration 24

The admin project serves the public `POST /api/station-interest` used by the
mobile login's station-owner card. Middleware exempts this exact path. Apply
`20260916000024_station_interest_leads.sql` (RLS-protected leads, hashed-IP rate
limits, service-role-only RPC) before shipping the mobile UI; until then the route
returns 503.

Admin Production variables: `STATION_LEADS_RATE_SECRET` (server-only, at least 32
characters; the route returns 503 without it), and for email notification
`RESEND_API_KEY`, `STATION_LEADS_EMAIL`, `STATION_LEADS_FROM`. Without the email
variables leads are stored with `email_status=pending`. The route trusts
`x-forwarded-for` only when `VERCEL=1`. Details, limits and release order are in
[`apps/mobile/STATION-INTEREST.md`](apps/mobile/STATION-INTEREST.md).

### Performance RPCs and middleware fast path — migration 25

Apply `20260925000025_performance_rpcs.sql`, then deploy both apps. It adds four
`SECURITY INVOKER` functions keyed on `auth.uid()`: `get_authenticated_user_context`
(profile, platform-admin flag and active memberships in one call),
`get_station_schedule_workspace` (schedule, templates, members and availability),
and `assign_worker_to_shift_rpc` / `remove_worker_from_shift_rpc`, which check
`can_manage_station_schedule`. No tables, policies or data change. If an RPC call
fails, the code falls back to the previous RLS queries, so deploying before the
migration works without the latency gain.

Both middlewares now decode the Supabase auth cookie locally and call
`auth.getUser()` only when the cookie is missing, malformed or within 60 seconds of
expiry. Middleware is a routing gate; data access remains enforced by Supabase with
the caller's JWT and RLS. Schedule assign/remove no longer revalidates the page;
the admin schedule updates optimistically and rolls back on failure. No new
environment variables. `node --test tests/auth-security-regression.test.mjs`
covers the middleware paths.
