# Mobile Phase 5 — notifications

Implemented without production migration, push, infrastructure provisioning, or deployment. Native delivery remains disabled until the owner completes the activation steps below. Phases 1–4, attendance, location permissions, and NFC behavior remain unchanged.

## Delivery architecture

An AFTER publication trigger writes deduplicated, worker-owned inbox entries in the same database transaction as the published schedule. No external HTTP call occurs in publication. `POST /api/internal/notifications` in the admin app generates due reminders, claims up to 100 device deliveries, sends Expo requests, and processes up to 100 due receipts. Database failures remain distinguishable from transport failures. A push outage cannot undo a published schedule.

The owner must configure a trusted scheduler to POST to this endpoint every minute. Nothing schedules requests automatically yet. Delivery and reminder generation do not run until that scheduler is activated. Use the existing hosting/scheduler account; no paid service was provisioned. Do not load-test production.

Publication rule: notify each assigned active worker once per schedule. Reopening and republishing does not notify a previously notified worker again. A newly assigned worker can receive their first notification on a subsequent transition to PUBLISHED. Editing an already published schedule does not generate another announcement. This deliberately avoids edit spam.

Reminders default to 60 minutes; workers can choose 30 minutes or off. Each scheduler invocation reads current published assignments, preferences, memberships, station/profile state and authoritative timestamptz starts. There are no local scheduled notifications or offline queues. A moved shift has a new start-based event key; pending old reminders are cancelled. Removed assignments, inactive memberships, disabled preferences and unpublished schedules are checked again at claim time. Server downtime can result in a later reminder, but none is generated after the shift starts. No timezone arithmetic is duplicated in mobile.

Transport lives in `apps/admin/app/api/lib/notification-delivery.ts`; the native app imports only the explicit database public entry. Service-role and optional Expo credentials exist only on the server. The endpoint uses constant-time bearer-secret comparison. The public client cannot invoke dispatch or insert inbox records.

## Models and security

Migration: `supabase/migrations/20260913000019_worker_notifications.sql`.

- `worker_devices`: one row per installation, globally unique Expo token, user/session ownership, platform/version, last-seen state. An installation UUID and random proof are stored in SecureStore; only its SHA-256 proof is stored server-side. Transfer between accounts requires this proof. Tokens and proof/session fields are not readable through the authenticated table grant. Registration uses a restricted RPC instead of allowing direct inserts/updates that could hijack a token.
- `worker_notification_preferences`: own-user schedule preference and reminder minutes (0/30/60). These govern push interruptions; inbox history remains available.
- `worker_notifications`: server-created inbox, station scope, type, minimal title/body/structured destination, read timestamp and unique logical-event key. Own-user RLS additionally requires active profile/station/membership. Read changes use an own-user RPC; workers cannot rewrite message content.
- `worker_notification_deliveries`: private per-device ledger, unique notification/device, token snapshot, attempt/state/ticket/error information. No worker table access.

Device registration validates auth.uid(), active profile, and the JWT session against auth.sessions. Logout attempts installation detachment before local-scope sign-out; a successful server session deletion also cascades registration. Cleanup failure does not prevent authoritative sign-out. Account changes remount the notification state; late old-account responses are ignored. Permission revocation deletes the registration on foreground sync. Inactive tokens are disabled on DeviceNotRegistered; installations unseen for 30 days are removed by the dispatcher. Reinstallation creates a new proof when secure storage is absent; restored iOS keychain state can safely reuse a proven installation.

No advertising/hardware identifiers or device names are collected. Lock-screen content is generic. A push accepted before logout/removal cannot be recalled; opening it still validates the current account and membership. System trays are cleared during successful detach.

## Reliability limits

Inbox creation and delivery claims are transactional and deduplicated. Explicit rate rejection retries after five minutes, with at most three attempts while the event remains relevant. A lost response, malformed response, server 5xx, or interrupted claimed send is marked **uncertain** instead of blindly repeating a possibly accepted push. Expo does not offer an exactly-once idempotency key. This favors no duplicate interruption over guaranteed push arrival; the inbox is the durable source of history.

Tickets are checked after 15 minutes. Missing/failed receipt requests back off 15 minutes without blocking new sends or resetting the 23-hour receipt deadline. Missing receipts become uncertain after 23 hours. Receipt success means Expo's downstream acceptance, not proof a person saw the notification. Requests time out after 10 seconds. An interrupted send is released to uncertain after five minutes. Never reset uncertain rows to pending automatically.

One invocation handles at most 100 sends and 100 receipts. Measure live throughput/region latency before increasing those bounds. Safe logs contain aggregate counts; ledger codes omit provider payloads and tokens from logs. Inbox history is retained until account/station deletion; define an owner-approved retention policy before large-scale rollout. There is no automatic historical purge in this phase.

## Native experience

Home has a quiet bell/count (9+ cap), contextual permission explanation, and a foreground update message. Profile opens the inbox and its notification choices. There is no sixth tab. Inbox supports read/unread styling with explicit text, marking all read, refresh, 30-row pages, empty/error states and long text. The native permission sheet explains the benefit before requesting OS permission; “not now” is remembered. Denied permission offers system settings and never blocks app use. Android's channel is created before requesting permission.

A tap carries only notification ID and recipient ID. The app restores auth, reads the own inbox record, refreshes memberships, verifies the published schedule and current assignment for reminders, then switches station and opens the correct Schedule day. Existing availability unsaved-change confirmation remains in the navigation path. Pending destinations are stored for at most one day and rejected for a different signed-in user. No human notification text is parsed for navigation.

Foreground OS banners/sounds are suppressed. Inbox/count refresh instead, with a calm Home message. There are no background/location permission requests.

## Manual activation

1. Inspect the entire migration. Paste its entire contents into the Supabase SQL editor if using the dashboard; a function signature alone is not executable SQL.
2. Apply only after backup/review and confirming the intended database. Tables are new; the publication trigger requires a brief lock on schedules. The supporting start-time index uses ordinary CREATE INDEX and can block writes while built on a large scheduled_shifts table. Schedule a quiet maintenance window; inspect table size first. No existing RLS policy or attendance constraint is replaced.
3. Configure the server variables and activate the minute scheduler.
4. Confirm EAS project ownership and production bundle/package IDs. Configure APNs and FCM v1 through EAS credentials for the intended app. Rebuild the native development/production app; Expo Go and an OTA-only update cannot supply the new native modules.
5. Set the public feature flag for that build and verify on a non-production physical installation before production rollout.

Server (admin deployment only):

| Variable                    | Type   | Value/purpose                                                                                      |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `NOTIFICATIONS_ENABLED`     | Config | `true` enables dispatch; missing/false disables it                                                 |
| `NOTIFICATIONS_CRON_SECRET` | Secret | Random, long bearer secret shared with the trusted scheduler                                       |
| `EXPO_ACCESS_TOKEN`         | Secret | Optional Expo push access token; required if enhanced push security is enabled in the Expo project |
| `NEXT_PUBLIC_SUPABASE_URL`  | Config | Existing project URL                                                                               |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Existing server-only key                                                                           |

Mobile build:

| Variable                                                    | Type          | Value/purpose                                                      |
| ----------------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| `EXPO_PUBLIC_NOTIFICATIONS_ENABLED`                         | Config        | `true` after migration/signing setup; missing disables integration |
| `EAS_PROJECT_ID`                                            | Config        | Confirmed Expo project UUID, exposed through app config            |
| `MOBILE_IOS_BUNDLE_ID`                                      | Config        | Confirmed signed app identifier                                    |
| `MOBILE_ANDROID_PACKAGE`                                    | Config        | Confirmed signed app package                                       |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public config | Existing worker client values; RLS remains authoritative           |

Use a separate test Supabase project for test/preview push activation. Do not enable a test scheduler against production data. No secret belongs in any EXPO_PUBLIC or NEXT_PUBLIC variable. Existing web/admin domain and NFC configuration are unchanged.

From the repository root, inspection and **later owner-run** apply:

```sh
cat supabase/migrations/20260913000019_worker_notifications.sql
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260913000019_worker_notifications.sql
```

`SUPABASE_DB_URL` is an owner-supplied direct database connection string, never a mobile environment variable. These commands do not set it or infer a production target.

Scheduler request (store the secret in the scheduler's secret manager; do not commit a filled-in header):

```sh
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $NOTIFICATIONS_CRON_SECRET" \
  https://admin.paz.darb.co.il/api/internal/notifications
```

Use a one-minute cadence with bounded retries and a timeout compatible with the endpoint's 60-second limit. No Vercel cron plan is assumed. Monitor failed/uncertain counts and backlog in the private delivery ledger. Owner cloud-side setup is unverified.

## Changed areas

- Native screens: `app/inbox.tsx`; Home/Profile entry points; root notification provider and existing tab-shell bridge.
- Native modules: `src/notifications/{Provider,UI,device,logout}.tsx/ts`; session logout integration and guarded station navigation in WorkerProvider.
- Safe data boundary: `packages/database/src/mobile-notifications.ts` exported by `packages/database/public.ts`.
- Server: `apps/admin/app/api/internal/notifications/route.ts` and `apps/admin/app/api/lib/notification-delivery.ts`.
- Schema: migration 20260913000019; local SQL bootstrap and transactional fixture checks in `tests/sql`.
- Dependencies: Expo Notifications 57.0.18, Device 57.0.2, Crypto 57.0.3; explicit existing Supabase JS 2.115.0 dependency in admin. No framework upgrade. Native plugin and lockfile updated.
- Tests: device/deep-link, inbox UI/navigation and logout coverage under mobile tests; Expo transport tests under root tests; isolated visual preview under mobile tests/visual.

## Disable / rollback

Disable the scheduler and set server NOTIFICATIONS_ENABLED=false first. Disable the mobile feature flag in the next build/update. Existing login, scheduling, availability, hours, and attendance continue without this feature. Leave inbox data intact. To stop inbox creation as well, an owner can remove `queue_worker_publication` from public.schedules after disabling delivery. Do not drop tables/history as an automatic rollback. Reverting this commit removes native UI/client calls; retain the migration until any deployed clients have stopped using its RPCs.

## Verification

Passed on local macOS: 71 mobile tests (53 prior + 18 new), 75 root regressions (65 prior + 10 transport tests), the local transactional SQL/RLS/device/queue script, workspace typecheck/lint/format, web and admin production builds, Expo Doctor 21/21, iOS native development build, and iOS/Android Hermes exports with the notification flag both disabled and enabled. Enabled source maps contain no server delivery module, Supabase SSR, PDF engine, fixture routes, or privileged environment-variable names.

Simulator review used isolated fixtures on iPhone 17 Pro Max, iOS 26.5, with constrained 320/390/430-point content widths. Reviewed permission explanation, denied settings, empty and read/unread inbox content, long text, 1 and 9+ badge states, and accessibility-extra-large text after relaunch. The text setting was restored; the temporary preview route was removed. Android runtime, OS push delivery and actual task-completion speed were not measured.

Replacing an accidental icon barrel import with the established per-icon imports reduced this implementation's intermediate Hermes bundles from 5.3 MB to 3.8 MB (iOS) and 5.5 MB to 4.0 MB (Android). This is an intermediate implementation comparison, not a claim of improvement over Phase 4.

```sh
pnpm --filter @yellowshifts/mobile test
node --test tests/*.test.mjs
pnpm typecheck
pnpm lint
pnpm format
pnpm build
pnpm --filter @yellowshifts/mobile exec npx expo-doctor
pnpm --filter @yellowshifts/mobile exec expo export --platform ios --platform android --source-maps
psql -h /tmp -d paz_mobile_phase5_test -X -v ON_ERROR_STOP=1 -f tests/sql/worker-notifications.sql
```

The final SQL command assumes the disposable local test database has already been bootstrapped with the test auth schema, identity/schedule migrations and the Phase 5 migration. Never point test bootstrap or fixture scripts at production. Local SQL tests use a disposable PostgreSQL database with stub auth.uid()/auth.jwt()/auth.sessions, real station/schedule tables, triggers and RLS; they are not a hosted Supabase Auth integration test. Transport tests mock Expo HTTP. Native fixture previews are under tests/visual only and are never application routes in release exports. No real push was sent and no production data was created.

Physical-device follow-up: APNs/FCM delivery, OS permission grant/revoke, background/terminated taps, expired-session login return, two-device receipt delivery, token rotation/reinstall, VoiceOver/TalkBack and Android UI need signed-device verification. Large-text and RTL checks in Simulator do not replace those tests.

Phase 6 recommendation: first complete this signed-device rollout checklist; then separately plan the user-approved geofencing/NFC scope. Phase 6 implementation has not started.
