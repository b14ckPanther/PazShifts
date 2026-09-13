# Phase 7 — native NFC attendance

## Audit before implementation

The web route is `/nfc/[token]`. Middleware assigns a UUID receipt and timestamp to a bare tag visit; login preserves them. Web currently auto-confirms entry and explicitly confirms checkout. Keep that UX unchanged.

Reuse `process_nfc_scan` from migration 17: authenticated identity, active profile/membership, token revocation, station-configured radius/accuracy, fresh scan location, advisory worker lock, durable idempotency receipts, 10-second duplicate coalescing, 15-minute scan expiry, authoritative timestamps and existing attendance constraints/triggers. Legacy TypeScript insert/update helpers are **not** a suitable native mutation path.

Native needs a mobile-safe token-scoped preview and a thin transactional expected-action wrapper, so attendance changed after preview cannot turn intended checkout into check-in. Receipt replay must precede expected-state checks. Native must persist the receipt before sending and never queue a write offline.

Existing domains: `paz.darb.co.il` and retained `paz-shifts.vercel.app`, per DEPLOYMENT.md. Both must serve association documents without authentication or redirection. Public route scope is `/nfc/*` only. No token rotation or tag rewrite.

Apple signing identifiers/certificate fingerprints remain external setup inputs. Never invent a Team ID or SHA256 fingerprint. Missing association configuration fails closed. Native routes, guards and web fallback can be implemented before signing.

Static URL tags and client-provided GPS cannot cryptographically prove a physical scan. Native mock-location detection, fresh precise scan location, auth/session checks and atomic receipts reduce abuse, but do not defeat rooted-device spoofing or shared credentials. Push installation registration is optional and is not device attestation; it must not become an attendance prerequisite.

The Phase 5 delivery queue currently supports only schedule publication/upcoming reminders. LEFT_OPEN is an existing attendance exception with a configurable station threshold (default 12 hours), not yet a delivery category. Integrate that threshold with the existing server notification queue; geofencing must not own this reminder.

## Implemented

- Strict HTTPS routing for both worker hosts; only `/nfc/<public-token>` is accepted. Custom NFC schemes, foreign hosts, path traversal and malformed receipt parameters are rejected. Existing tag contents remain unchanged.
- A native RTL confirmation screen previews authorized station/active attendance, explains foreground location use, and requires an explicit press for both entry and exit. It displays confirmed server timestamps, the receipt date and the existing long-open threshold warning. No optimistic attendance and no offline mutation queue.
- The mobile-safe database entry exports only `getNativeNfcContext` and `submitNativeNfc` plus their types. No service-role, SSR or second attendance engine is imported.
- A pending receipt and frozen intended action are stored in SecureStore before transmission. Same-receipt retries, read-only recovery, account ownership checks, explicit logout cleanup and screen identity guards protect against lost responses and account changes. The pending receipt expires locally after 24 hours; the existing server scan lifetime remains 15 minutes.
- One fresh foreground precise location fix is requested on confirmation, bounded to 12 seconds. Detectable mocked locations and stale fixes are rejected. The server applies the existing station radius/accuracy/freshness checks. No coordinate history, background permission requirement or continuous tracking was introduced for attendance.
- Confirmed attendance invalidates the mounted Home reader and reconciles the existing optional geofences. Hours retains its existing focus refresh. A LEFT_OPEN inbox/push category uses the existing server queue, active attendance and station threshold (default 12 hours); one logical notification per record. Reminder-off disables this category too. Completion, inactive membership or disabled preferences make delivery ineligible. Taps validate the owned active record and open the station's Home.
- AASA and assetlinks endpoints bypass authentication, serve JSON without redirects and restrict iOS paths / Android manifest filters to NFC. Missing signing configuration returns 503/no-store instead of fabricated association data.

## Migrations and rollout

Created, tested only in disposable local PostgreSQL, **not applied to production**:

1. `20260913000020_native_nfc.sql`: `process_native_nfc_scan(token, scan_id, scanned_at, expected_action, expected_record, latitude, longitude, accuracy, location_at)` returns the existing `NfcScanResult` JSON contract. `read_native_nfc_receipt(token, scan_id)` returns an owned receipt or null. Both require authenticated active access and an existing unexpired Auth session. SECURITY DEFINER is necessary because workers cannot directly access receipt rows or mutate attendance; fixed search_path, auth checks and minimal grants retain that boundary.
2. `20260913000021_left_open_notifications.sql`: extends the existing notification type and server-only queue eligibility/claim wrappers. No new attendance table or new delivery provider. Existing schedule queue functions are retained under `_schedule` names. Workers cannot execute dispatch.

Inspect the complete files, not a function signature pasted by itself:

```sh
cd /Users/zangeel/Documents/GitHub/PazShifts
less supabase/migrations/20260913000020_native_nfc.sql
less supabase/migrations/20260913000021_left_open_notifications.sql
```

Later, after review and with an owner-selected database connection in `SUPABASE_DB_URL`, apply in order (this variable is for the manual shell command, not the mobile app):

```sh
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260913000020_native_nfc.sql
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260913000021_left_open_notifications.sql
```

Alternatively run each **entire file** in Supabase SQL Editor, in order. Both files contain BEGIN/COMMIT. Migration 21 briefly locks the notification table while replacing its type constraint; schedule during a quiet window. Existing eligible long-open records can be notified when the existing dispatcher next runs. Apply DB support before releasing the native attendance build.

## Association configuration — owner action still required

Worker Vercel project server configuration (public signing identifiers, not secret keys):

| Variable                    | Required value                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APPLE_APP_IDS`             | Comma-separated actual application identifiers: Apple App ID prefix + `.` + signed bundle identifier. Confirm the prefix in Apple/EAS; it is usually the Team ID, but must not be guessed.       |
| `ANDROID_APP_LINKS_PACKAGE` | Actual signed Android package. Current development default is `il.co.darb.yellowshifts.dev`.                                                                                                     |
| `ANDROID_APP_LINKS_SHA256`  | Comma-separated SHA-256 signing certificate fingerprints, colon-separated bytes. Include the relevant EAS development/release certificate or Google Play app-signing certificate as appropriate. |

Existing native overrides remain `MOBILE_IOS_BUNDLE_ID`, `MOBILE_ANDROID_PACKAGE`, and `EAS_PROJECT_ID`; development bundle/package default remains `il.co.darb.yellowshifts.dev`. No new mobile secrets or packages. Existing `EXPO_PUBLIC_NOTIFICATIONS_ENABLED` controls Phase 5 push features; left-open delivery additionally needs the existing Phase 5 dispatcher/provider setup. Neither push permission nor device-token registration is required for attendance.

Deploy the association endpoints to **both** `paz.darb.co.il` and `paz-shifts.vercel.app` on the worker project. Keep the legacy hostname serving the app instead of redirecting it to the new hostname. Verify each well-known endpoint returns 200 JSON with no redirect before testing installation. Do not associate development builds with production hosts unless intentionally testing that build. Configure production signing identifiers before its build; do not publish placeholders.

Build a new signed development binary after Apple activation / Android credentials are available:

```sh
pnpm --filter @yellowshifts/mobile exec eas build --profile development --platform ios
pnpm --filter @yellowshifts/mobile exec eas build --profile development --platform android
```

[Expo Universal Links](https://docs.expo.dev/linking/ios-universal-links/), [Android App Links](https://docs.expo.dev/linking/android-app-links/), and [native intent handling](https://docs.expo.dev/router/advanced/native-intent/) informed this setup. AASA/OS association caching, user browser preferences and signing affect delivery to the app; an installed app does not guarantee the OS will choose it.

## Rollback

Keep web NFC available throughout rollout. Revert the Phase 7 commit and rebuild native to remove its associated-domain configuration. Association responses can be disabled by removing the new worker server configuration, but OS caches mean this is not an instantaneous kill switch. Reverting client code leaves existing attendance and receipts intact; do not delete attendance to roll back.

If removing SQL support, first stop distributing clients that call the new RPCs. Migration 20's two new functions can then be dropped by their exact signatures. For migration 21, remove its new `claim_worker_notifications()` and `worker_notification_current(worker_notifications)` wrappers, rename the retained `_schedule` functions back and restore the service-role EXECUTE grant on the claim function. Retain existing LEFT_OPEN inbox records/type allowance rather than deleting history. No production rollback was performed.

## Verification / limitations

- Disposable PostgreSQL tests execute every migration plus existing notification SQL/RLS/device tests and NFC transaction tests. Native coverage includes six concurrent confirmations, expected-state mismatch, receipt recovery, revoked sessions, inactive/foreign membership and location denial. LEFT_OPEN tests cover queue deduplication, disabled preference, completed-record cancellation and privileged dispatch.
- Native unit/component tests use controlled fixtures for URL validation, SecureStore recovery, explicit confirmation, duplicate taps, same-intent network retries, session ownership, location denial/accuracy/mock/staleness and safe login return. These are not physical NFC or hosted Supabase Auth tests.
- Simulator visual review: iPhone 17 Pro Max / iOS 26.5, constrained 320/390/430-point content, entry, long-open checkout, confirmed receipt, pending and failed response. Accessibility-extra-large text wraps; full gesture/VoiceOver usability at that size remains device QA. The original Simulator text size was restored. `tests/visual/NfcPreview.tsx` is an isolated fixture; its temporary application route was removed before final export.
- iOS Simulator compilation succeeds with `CODE_SIGNING_ALLOWED=NO`. The Expo signed build command cannot proceed without Apple code-signing credentials. This does not verify Universal Links or signed-device entitlements in practice.
- Physical pending: actual tag tap on both hosts, installed/uninstalled web fallback, cold/warm app, login recovery, precise location at station radius boundaries, location denial, two devices, revoked session, network loss around commit, APNs/FCM left-open delivery, Android runtime/App Links and VoiceOver/TalkBack. No production attendance was created or modified during this phase.

The implementation cannot prove that a static public URL was read from a physical tag. A copied URL remains usable with valid credentials and an accepted location fix. Stronger anti-proxy guarantees require a separately designed attestation or rotating/challenge-capable tag system; this phase does not claim those guarantees.

Final local results: **126 mobile tests**, **75 root regressions**, disposable NFC/notification SQL suites, all 9 workspace typecheck/lint tasks, repository formatting, both Next production builds, Expo Doctor **21/21**, both Hermes exports with notifications enabled, and iOS Simulator native compilation passed. Production-build HTTP checks against localhost confirmed 503/no-store when unconfigured and 200 JSON/no redirects with isolated signing fixtures. Final source maps exclude visual fixtures, Supabase SSR, server notification delivery and PDF modules. Dependencies added: **none**.

Commands used for verification:

```sh
pnpm --filter @yellowshifts/mobile test
node --test tests/*.test.mjs
python3 tests/nfc-scans-db.py
pnpm typecheck
pnpm lint
pnpm format
pnpm build
pnpm --filter @yellowshifts/mobile exec npx expo-doctor
EXPO_PUBLIC_NOTIFICATIONS_ENABLED=true pnpm --filter @yellowshifts/mobile exec expo export --platform ios --platform android --source-maps
pnpm --filter @yellowshifts/mobile exec expo prebuild --platform ios --no-install
xcodebuild -workspace apps/mobile/ios/YellowShifts.xcworkspace -scheme YellowShifts -configuration Debug -sdk iphonesimulator -destination 'id=B30040A8-46FD-4665-923E-6841AD79E68B' CODE_SIGNING_ALLOWED=NO build
```

The Simulator UUID is local to this machine. The attempted `expo run:ios --device B30040A8-46FD-4665-923E-6841AD79E68B --no-bundler` stopped because no code-signing certificate was available; the explicit Simulator-only Xcode command above succeeded. No signed build, production deploy or push was performed. Next recommended step is Phase 5.5 signing plus the Phase 7 physical checklist, not another attendance feature.
