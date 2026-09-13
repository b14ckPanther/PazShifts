# Phase 8 — release hardening and operational readiness

## Decision and scope

Repo-side hardening is prepared for signed internal qualification, **not public release approval**. Production identifiers are owner-confirmed: iOS bundle ID and Android package `il.co.darb.yellowshifts`. Development remains `il.co.darb.yellowshifts.dev`. Apple enrollment/credentials, Android signing/FCM, final associations, asset approval, privacy metadata and physical QA remain release gates. Implementation, simulator compilation and physical verification are different milestones.

No Phase 9 features, migrations, hosted SQL, production data changes, scheduler activation, credential rotation, DNS changes, deployment, push, TestFlight upload or store submission were performed. Existing migrations 18–21 remain prerequisites; verify their deployment history on the intended backend separately.

## Audit checklist and changes

- [x] Separate development/preview/production identities and environments; reject conflicting identifier overrides and unknown profiles.
- [x] Default unverified release native associations/background monitoring/remote push off.
- [x] Audit existing assets without inventing a final logo.
- [x] Recover root errors without leaving the splash covering recovery UI; scalable Hebrew retry state, no stack traces.
- [x] Coalesce overlapping startup context reads only while in flight; resume still revalidates authorization. Clear account presentation immediately at logout.
- [x] Serialize incoming NFC/pending-state operations; retain existing durable receipt recovery and explicit attendance confirmation.
- [x] Remove unused historical Home preview; retain isolated visual fixtures outside application routes.
- [x] Add repeatable production source-map boundary inspection.
- [x] Inspect scheduler, receipt cleanup, session/RLS boundaries, background tasks and network guards.
- [x] Fix two transitive dependency advisories with scoped overrides and a compatibility patch; avoid framework upgrades.
- [x] Add release configuration, permission gating and session regression coverage; repair disposable SQL harness prerequisites.
- [x] Document signing, stores, privacy gaps, physical QA and rollback.

## Release profiles and capabilities

| Profile            | Identity      | EAS environment | Purpose                                   |
| ------------------ | ------------- | --------------- | ----------------------------------------- |
| development        | `.dev`        | development     | iOS Simulator / native development        |
| development-device | `.dev`        | development     | signed physical development build         |
| preview            | production ID | preview         | signed internal qualification             |
| production         | production ID | production      | store candidate, not automatic submission |

Preview and production replace each other on a device. Development installs separately. EAS project remains `@millionroses/yellowshifts-worker`, UUID `c737ab37-6406-450c-ace7-b516e7815c93`. No external ownership/credential changes were made.

`eas.json` uses remote build-number/versionCode management and auto-increments preview/production. Marketing version remains `1.0.0`. Inspect existing EAS/store version state before initializing remote counters; do not reset an existing counter. No EAS Update/OTA rollout is configured. Native permissions, association and capability changes require a new binary.

Preview/production explicitly pin these build flags to `false`:

- `EXPO_PUBLIC_NOTIFICATIONS_ENABLED`: existing remote push/device registration gate.
- `EXPO_PUBLIC_NATIVE_NFC_ENABLED`: native HTTPS associations and native attendance route capability.
- `EXPO_PUBLIC_BACKGROUND_LOCATION_ENABLED`: reminder UI, permission requests and background location capability.

Development retains NFC/location testing defaults; location remains user opt-in. To qualify a release capability, deliberately edit the reviewed preview profile flag and rebuild; do not assume remote EAS variables override the pinned profile value. Enable production only after the matching physical tests. Missing runtime feature manifest values fail closed.

The existing web NFC fallback and both public hosts remain supported: `paz.darb.co.il` and legacy `paz-shifts.vercel.app`. Default release associations are empty, so installed release apps do not claim these HTTPS NFC URLs. A manually opened disabled native attendance route explains web attendance and offers Home; it does not mutate attendance. Foreground scan validation is independent of optional background reminders.

Release plugin guardrails remove unused Face ID, Bonjour/local-network permission copy and nonessential background `fetch`/`location` modes when location is disabled. ATS disallows arbitrary loads. Android backup is disabled; release manifests block legacy storage/overlay permissions. Development-client generated schemes are disabled for release. No continuous GPS service was introduced.

## Security and resilience findings

- Mobile uses the explicit database public entry; no service-role, SSR, admin delivery or PDF engine enters the inspected production maps. The source-map check is a module-boundary check, not a substitute for secret scanning or review of future changes. Maps stay ignored/local.
- Existing SecureStore/session safeguards, foreground revalidation, worker membership checks and RLS remain authoritative. No caller-selected worker identity or installation ID becomes authorization. Startup sharing is a pending promise, not an authorization cache.
- Pending native NFC state is account-bound and receipt-aware. Opening a native link does not write attendance; explicit confirmation invokes the existing server RPC with idempotency. A timeout is not shown as a successful mutation and does not automatically enqueue/repeat attendance offline.
- Static NFC URLs can be copied. Client location can be spoofed. Existing server distance/freshness/accuracy and session/device controls reduce abuse; they are not cryptographic proof of physical presence. No face/QR/device-fingerprint feature was added.
- Geofence events do not authorize or mutate attendance, do not upload movement trails and use authenticated reads. Exit reminders require current/recent bounded ACTIVE evidence; failure favors skipping a reminder. Logout unregisters/cancels account-bound local work.
- Existing data screens preserve drafts or last loaded read-only data on failure rather than claiming new server success. Availability failure retains edits. Mutation retries remain explicit. Root retry UI hides the splash, handles retry failure and avoids raw exception text.
- No third-party crash service was added. Non-sensitive operational logging remains; no production UI exposes tokens, coordinates, raw database errors or stack traces. Evaluate a consent/privacy-reviewed crash integration later; absence of remote crash aggregation is an operational limitation.
- `decode-uri-component` malformed-input advisory was addressed via a narrow query-string dependency override to 0.5.0 and two-line CJS/default-export compatibility patch. The xcode tooling UUID override uses 11.1.1. Query parsing, malformed input and native exports/prebuild are checked. Production dependency audit reports zero advisories at this run; this is time-specific, not a guarantee.

## Performance and accessibility

Overlapping auth startup events now share one pending worker-context read; a regression verifies one initial call and a fresh resume call. No measured physical cold-start improvement is claimed. Fonts stay bundled; existing memoized shared report calculations remain the single reporting truth.

Local Node benchmark, 100 iterations per fixture, measured reporting/presentation at 7/31/93 days: engine p95 0.82/1.77/4.59 ms, presentation p95 0.04/0.10/0.38 ms. These desktop measurements did not justify a new engine or list dependency; they are not mobile frame-time measurements.

Button labels can shrink alongside progress indicators; tab labels remain constrained to their columns. Root recovery scrolls for larger text and announces heading/button/busy semantics. Existing reduced-motion, RTL, accessibility labels and independent date chronology remain. Simulator/physical VoiceOver and TalkBack, full 320/390/430-width screen matrices and maximum font scaling still require explicit qualification; automated component tests are not a screen-reader certification.

## Assets and native metadata

Existing red YellowShifts mark and splash are retained. Source icon is 1254×1254 with transparency; generated iOS 1024 icon is opaque. Owner approval of final brand assets remains required. Dedicated Android adaptive foreground/background, monochrome and notification-silhouette assets are not configured: obtain approved variants before store release. Do not ship a generic icon fallback as final notification branding. No temporary image was invented.

Display name is YellowShifts. Scheme remains `yellowshifts`; verify both development and release install behavior. Generated iOS deployment target is 16.4. Tablet support is currently enabled and adds iPad layout/screenshot QA obligations. Actual distribution `aps-environment` must be verified in the signed provisioning/export; a simulator entitlement is not APNs qualification. The installed React Native Gradle version catalog sets Android minimum SDK 24 and compile/target SDK 36; generated app Gradle consumes that catalog. Verify the resulting signed artifact and current Play requirements during release setup. Android native compilation is not established by a JavaScript export.

## Associations: ready for real signing values

Website endpoints already fail closed with 503/no-store when signing configuration is absent; do not substitute fabricated IDs. Configure on the worker deployment serving **both** hosts:

- `APPLE_APP_IDS`: actual Apple App ID prefix plus `.il.co.darb.yellowshifts`. Confirm the prefix from Apple/EAS (often Team ID, not assumed). Add a `.dev` entry only for deliberate development qualification.
- `ANDROID_APP_LINKS_PACKAGE=il.co.darb.yellowshifts`.
- `ANDROID_APP_LINKS_SHA256`: actual colon-separated certificate SHA-256. Google Play app-signing and upload/development certificates can differ; use the certificate that signs the installed binary.

Then inspect direct 200 JSON responses without authentication/redirects:

```sh
curl --fail --include https://paz.darb.co.il/.well-known/apple-app-site-association
curl --fail --include https://paz.darb.co.il/.well-known/assetlinks.json
curl --fail --include https://paz-shifts.vercel.app/.well-known/apple-app-site-association
curl --fail --include https://paz-shifts.vercel.app/.well-known/assetlinks.json
```

Do not open a real NFC URL merely to smoke-test deployment: the legacy authenticated web flow can write attendance. Native association scope is `/nfc/*`, not the whole website. AASA/assetlinks acceptance and OS caches must be tested with the signed installed app after enabling preview associations.

## Notification and scheduler activation

Existing server architecture persists deduplicated inbox/outbox work after authoritative publication; workers assigned to that schedule are targeted. Provider failures do not undo publication. Schedule retries, device uniqueness and per-delivery claims prevent duplicate logical inbox entries. Receipt processing removes invalid devices; old installations expire after 30 days. Ambiguous in-flight sends become uncertain instead of blindly resending. Known retryable failures have bounded retries. Multi-device/account switch still needs physical testing.

No production scheduler is active from this phase. Configure an authenticated external HTTP scheduler only after test qualification:

- POST `https://admin.paz.darb.co.il/api/internal/notifications` every minute; five minutes trades reminder timeliness for fewer invocations.
- Bearer `NOTIFICATIONS_CRON_SECRET`, stored in scheduler secret storage and admin server environment.
- Admin `NOTIFICATIONS_ENABLED=true`, correct Supabase URL/server-only service-role key, and `EXPO_ACCESS_TOKEN` if Expo enhanced push security is enabled.
- Runtime is Node with 60-second route limit. Expo transport has a 10-second timeout. Claims use lock/skip-locked and dedupe constraints; receipts are polled after 15 minutes, known retryable failures after five minutes, bounded to three attempts. Stale sending claims become uncertain after five minutes.
- Standard Vercel cron uses GET, while this route accepts POST: do not point an unauthenticated GET cron at it. No cron config is silently installed.

Manual **test environment only**, with variables populated privately by the operator:

```sh
curl --fail --request POST "$TEST_ADMIN_URL/api/internal/notifications" \
  --header "Authorization: Bearer $NOTIFICATIONS_CRON_SECRET"
```

Verify an isolated test worker's inbox, delivery claim/ticket/receipt state and device invalidation without logging full private payloads. Check scheduler execution/failure alerts. Existing station 12-hour left-open logic remains separate from geofencing and never auto-checks out. Remote push and background reminders are not required for core web attendance.

## Phase 5.5 continuation: Apple

Run from `apps/mobile`; these are manual future steps, not claims of execution:

```sh
eas whoami
eas project:info
eas device:create
eas credentials --platform ios
eas build --profile development-device --platform ios
```

1. Confirm Apple Developer membership is active and correct team is accessible. Preserve existing valid credentials; never revoke as troubleshooting.
2. In EAS credentials select the development-device profile, correct `.dev` identifier/team; configure/reuse APNs key, certificate and provisioning profile including the test device. Enter Apple credentials only in the CLI/Apple UI.
3. Install the signed development build. Use only a dedicated test worker/station. Confirm permission explanation, Expo token registration and correct account/device binding.
4. Test foreground/background/closed push, tap recovery, logout/account switch, second device, Universal Links, physical tag, duplicate/uncertain NFC mutation, arrival/exit and terminated behavior. Geofence delivery is best effort.
5. Repeat with preview production identity and its correct App ID/provisioning/association values after deliberately enabling the relevant preview flags. Verify signed entitlements, not simulator plist assumptions.
6. Prepare distribution build only after all readiness gates. No `eas submit` is part of this phase.

## Android continuation

1. Create/confirm Firebase Android app using `il.co.darb.yellowshifts` (separate `.dev` app for development if needed).
2. Obtain the client `google-services.json`; configure the existing `GOOGLE_SERVICES_JSON` file environment path. Obtain the Firebase project's FCM v1 service-account JSON for EAS server credentials, never an `EXPO_PUBLIC_*` value. Keep private JSON/keystore in ignored credential storage; do not paste credentials into chat or commit them.
3. Run `eas credentials --platform android`; choose the intended profile, reuse/create signing keystore and configure FCM v1 service-account credentials. Do not rotate a valid existing key.
4. Obtain actual signing SHA-256; configure assetlinks for the installed certificate. With Play App Signing, confirm Play's signing certificate rather than assuming the upload key.
5. Run `eas build --profile development-device --platform android`; install the signed test APK. Repeat preview/internal qualification with production identity, enabled reviewed flags and final assets.
6. Test notification channel/icon, Android notification/background/precise permissions, app-link verification, physical NFC, vendor battery restrictions, terminated app behavior and account switch. No aggressive battery exemption prompt is added.

## Privacy/data map — implementation draft, not questionnaire approval

| Data                                         | Actual handling                                         | Linked / purpose / sharing                                        | Retention questions                                                                                |
| -------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Account ID, name, email/phone                | Auth/profile server records                             | Linked; account access; Supabase/hosting                          | Owner must specify deletion/contact and retention                                                  |
| Membership, schedule, availability           | Server, RLS scoped                                      | Linked; scheduling                                                | Existing operational retention; formal duration not specified                                      |
| Attendance, corrections, hours               | Server attendance/reporting                             | Linked; work history and authorized administration                | Owner policy/legal retention needed                                                                |
| Installation ID, push token, session binding | Device registry; local secure installation state        | Linked; push delivery via Expo/APNs/FCM; not advertising identity | Logout/session invalidation and stale-token cleanup; document backups/provider retention           |
| Scan-time precise coordinates                | Sent for authenticated station-presence validation      | Linked request; attendance validation                             | No worker trail table added; verify gateway/provider logs before declaring no collection/retention |
| Geofence entry/exit and region metadata      | Local reminder processing, no route history uploaded    | Local optional reminders                                          | Bounded local dedupe/cache and logout cleanup; no worker path                                      |
| Inbox and read state/preferences             | Server inbox/push preferences; local location opt-in    | Linked; notification delivery/UX                                  | Formal inbox retention/deletion policy remains to be defined                                       |
| Diagnostics                                  | Limited operational/dev diagnostics; no crash SDK added | Hosting/provider logs may exist                                   | Review actual provider access/log retention                                                        |

No advertising or cross-app tracking SDK is introduced. Do not equate this audit with final Apple/Google privacy answers. Apple collection definitions depend on transmission and retention; inspect infrastructure logs and agreements. Scan-time location and optional background reminders need separate explanations.

Missing release policy decisions/URLs: published privacy policy, support URL/contact, controller identity, account deletion workflow, employment-record retention, backups, subprocessors, location purpose and consent withdrawal, push/device deletion, and data-subject requests. Existing app code does not establish a complete legal policy. No legal text was silently rewritten.

Background location is optional and assistive; attendance works without it. Google Play can require a core-functionality justification, prominent disclosure and demonstration video and may reject background access used only for convenience. Default release excludes that capability. If enabled, describe it honestly and submit the required declaration; do not disguise it. See [Play background location policy](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en) and [Android background location guidance](https://developer.android.com/develop/sensors-and-location/location/background). Review [Apple app privacy guidance](https://developer.apple.com/go/?id=info-1) before final disclosures.

## Store readiness

TestFlight remains pending: final distribution App ID/cert/profile/APNs, remotely managed build counter, owner-approved icons/splash, iPhone/iPad screenshots, support/privacy URLs, category, export-compliance assessment, privacy declarations and reviewer access. No encryption/export answer is assumed merely because the app uses standard HTTPS. Verify minimum OS/device coverage and signed release crash-free startup.

Play internal testing remains pending: Firebase/client file/FCM key, keystore and Play signing, actual target-SDK policy alignment, versionCode, approved adaptive/notification assets, data safety/privacy/support declarations, background-location review if enabled and signed device QA. Neither store was contacted/submitted to by this phase.

Suggested Apple review notes (complete with secure reviewer access instructions outside source control):

> YellowShifts is a worker scheduling and attendance app. A station NFC tag opens an HTTPS link; the authenticated worker confirms attendance and foreground location validates the station context. The website remains a fallback. Optional background location, when included/enabled, only supports station arrival reminders and reminders to scan out while attendance is active. It does not track routes or automatically record attendance. There is no face recognition or QR attendance. Core scheduling and attendance remain available without background reminders.

Provide a dedicated reviewer/test worker and test station/tag via the store's secure review channel. Plan how a reviewer can exercise location-dependent attendance; never add an authorization bypass or commit a password to make review easier.

## Safe QA matrix

Use a separate Supabase test project or explicitly isolated test station, worker, schedule and token/tag. Existing disposable SQL fixtures and native visual fixtures are preferred. Do not alter actual employee hours to obtain screenshots. Record OS/build/profile, account alias, expected result, observed result and pass/fail for each case.

| Area            | iOS and Android cases                                                                             | Required outcome                                                    |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Install/session | Fresh, logged out/in, expired/revoked session, password changed, disabled worker, long background | Recover/login safely; no old account content                        |
| Push            | Allowed/denied, foreground/background/closed, schedule publish/reminder/left-open, second device  | Correct recipient, no duplicate logical event, safe tap, no nagging |
| Inbox           | Empty/read/unread/9+, long text, stale target                                                     | Correct read state and authorized destination                       |
| Location        | Off/foreground-only/background/approximate, services off, permission downgrade                    | Optional; core app usable; no pointless monitoring                  |
| Geofences       | Enter/exit, active/closed/other-station, jitter, removed membership, no network, terminated       | Useful deduped reminder only; no attendance write or trails         |
| NFC             | Logged-out link recovery, invalid token, correct/wrong station, far/poor accuracy, duplicate tap  | Explicit confirmation and authoritative validation                  |
| NFC recovery    | Slow/offline, background/killed after submit before response, receipt retry                       | No fake success or duplicated attendance                            |
| Data            | Schedule unpublished/overnight, availability unsaved/error, Hours month/custom/correction         | Shared truth, draft preserved, timezone correct                     |
| Lifecycle       | Station/account switch, logout during request, two devices                                        | No cross-account state/notifications/monitoring                     |
| Accessibility   | 320/390/430 widths, largest text, RTL, VoiceOver/TalkBack, reduced motion                         | No clipped CTA, understandable order and state                      |
| Release         | Clean signed preview startup, default gates off, capability-enabled preview                       | No debug routes, real entitlements and safe web fallback            |

Physical tests still pending: signed iOS background geofence, terminated-app event, real arrival/exit, physical NFC, real APNs/FCM/local notification delivery, production-ID Universal/App Links, Android restrictions and two-device behavior. Simulator tests cannot certify these.

## Verification and release commands

See the run results below. Reproduce from repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @yellowshifts/mobile test
node --test tests/*.test.mjs
python3 tests/nfc-scans-db.py
python3 tests/staff-permissions-db.py
pnpm typecheck
pnpm lint
pnpm format
pnpm build
pnpm audit --prod
pnpm --filter @yellowshifts/mobile exec npx expo-doctor
EAS_BUILD_PROFILE=production pnpm --filter @yellowshifts/mobile exec expo export --platform ios --platform android --source-maps
pnpm --filter @yellowshifts/mobile check:bundle
```

For local unsigned iOS Release compilation (requires Xcode/CocoaPods), run prebuild from mobile, then `pod install` **inside `apps/mobile/ios`**. Running CocoaPods from the repository root fails Node module resolution in the generated Podfile. Generated native folders remain ignored. Do not overwrite a manually customized native project without reviewing it.

```sh
cd apps/mobile
EAS_BUILD_PROFILE=production pnpm exec expo prebuild --platform ios --no-install
cd ios
pod install
EAS_BUILD_PROFILE=production xcodebuild -workspace YellowShifts.xcworkspace -scheme YellowShifts \
  -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

## Rollback

Before rollout, keep a known-good signed build and the exact commit/lockfile. Roll back this phase by reverting its commit and rebuilding; do not individually remove the decoder patch while keeping its override. No database rollback is required. Build-time flags require a new binary to change; they are not instant remote kill switches. Disable server dispatch through its existing server flag if push must stop. Associated-link caching can outlive a website change, so verify installed behavior. Preserve web NFC fallback throughout.

## Validation run results

Results are updated at the end of the implementation run. Passing JavaScript bundles or unsigned simulator compilation never means signing or physical-device verification passed.

- Mobile: **133/133 passed**. Repository regressions/report tests: **75/75 passed**.
- Disposable SQL: atomic availability, notification/device/RLS and native NFC scenarios passed; separate staff/admin-role/manual-attendance/hour-rule harness passed. No hosted database was used.
- Nine workspace typechecks/lint tasks passed; repository formatting passed; web/admin production builds passed.
- Expo Doctor **21/21 passed** and Expo package alignment passed. Production dependency audit **0 advisories** after targeted fixes. Existing `@eslint/js` 10 / ESLint 9 peer warning remains; no unrelated mass upgrade.
- iOS and Android production Hermes exports passed, with both source maps passing the mobile boundary check. Export size is approximately 3.9 MB iOS / 4.1 MB Android (uncompressed JS/Hermes artifact, not installed app size).
- iOS native **Release** compile passed, both unsigned and locally ad-hoc signed for Simulator. The unsigned app's SecureStore initialization could not establish a usable session; a proper local Simulator signature restored normal login. This does not provision an Apple device or validate APNs.
- Android production prebuild passed; manifest inspection confirmed backup off, no default background permission and removed legacy storage/overlay permissions. Android native compile/device QA remains unavailable without Android SDK/toolchain. Export is not native compile verification.
- Manual Simulator review: actual production-identity Release startup/login, recoverable startup error, normal text and accessibility-extra-large wordmark (clipping found and fixed, then rechecked). Isolated development fixtures reviewed Schedule at 320 points, shift detail/coworkers sheet, Availability at 320/390, Hours at 320/430 with completed vs active distinction, and inbox at 320 with 9+ badge/read-unread and permission explanation. Temporary preview route was removed before final exports. No fixture route is delivered.
- These sampled inspections do **not** represent the complete large-text/VoiceOver/TalkBack/device matrix. Full keyboard/focus, every sheet at maximum scaling, Android rendering and all physical transition/delivery tests remain checklist items. No physical NFC/push/geofence delivery is claimed.

Changed file groups: mobile app/EAS config and `.env.example`; release plist plugin and runtime feature helper; root error recovery, login/onboarding typography, buttons/tab labels; session startup/logout; location capability guard; NFC pending serialization and guarded route; release bundle script; release/session/location/NFC tests and existing visual fixture adaptation; obsolete unused Home preview removed; scoped dependency override/lockfile/decoder patch; disposable SQL harness prerequisites; mobile README and this operational guide. No web/admin application behavior refactor or new migration.

Commit only this reviewed change set (commands from repository root; not executed):

```sh
git diff --check
git add apps/mobile pnpm-workspace.yaml pnpm-lock.yaml patches/query-string@7.1.3.patch tests/nfc-scans-db.py tests/staff-permissions-db.py
git commit -m "Harden YellowShifts mobile release configuration and recovery"
git push origin main
```

Final recommendation: **guarded repo-side release candidate for signed internal QA**. Do not call it store-ready or enable unverified capabilities broadly. Complete Phase 5.5 signing, approved assets/privacy metadata and the device matrix before production distribution. Stop here; no new product phase is started.
