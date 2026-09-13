# Phase 9 — release qualification

Audit date: 2026-09-14. Decision: **C. NOT READY — NO-GO for release-candidate distribution.**
The signed development app and APNs transport work. This is not a verdict that the product
needs more features: remaining gates are release identity, policy/assets, associations and QA.
No new features, hosted mutations, submissions, credential rotation or scheduler activation.

## Repository and database evidence

- HEAD/main: `a60ccbf` (`Configure iOS push and correct station-time reminders`). After
  `git fetch origin`, main and origin/main have zero divergent commits.
- Working tree was NOT clean at entry. Existing schedule display corrections remain modified:
  `apps/mobile/tests/home-query.test.mjs`, `apps/mobile/tests/week.test.mjs`,
  `packages/database/src/mobile-home.ts`, `packages/database/src/mobile-week.ts`,
  `tests/overnight-shifts.test.mjs`; untracked `apps/mobile/tests/schedule-instant-loader.mjs`,
  `apps/mobile/tests/schedule-instant.test.mjs`, `packages/database/src/schedule-instant.ts`.
  Preserve/review and commit these before a reproducible candidate. They were not changed here.
- `supabase migration list`: migrations 1–23 match local/remote; none pending. No new migration needed.
- No tracked p8/p12/mobileprovision/keystore/credentials.json/service-account filename found.
  Last 15 commit snapshots also contain no p8/p12/mobileprovision/credentials.json filenames.
- Limited content scan: no private-key markers or service-account JSON indicators in tracked
  files/recent 15 diffs; no known privileged local service-role/cron/Expo access values in
  recent diffs or exported files. This is a scoped scan, not a full-history secret-scanner certificate.
  Gitleaks is not installed. No secret contents printed.
- Temporary diagnostic calls are committed from prior work but guarded by `__DEV__` and log
  stage/permission/project ID only. Location diagnostics log result/count, not coordinates.
  Private QA harnesses, signed artifacts, credentials and source maps remain ignored.
- Both production export source maps pass the existing forbidden-module/fixture boundary check.

## Physical QA ledger

PASS means prior actual iPhone evidence plus owner confirmation where necessary, not a mock.
PENDING means no physical proof. No untested item is inferred passed from its implementation.
Tested binary: dev Ad Hoc `il.co.darb.yellowshifts.dev`, 1.0.0 (1), iPhone 15 Pro Max,
iOS 26.5. A production-ID TestFlight binary has not been tested.
Owner reports no second phone and no access to the physical station/NFC tag now.

| Area            | Case                                                               | Result / evidence                                                              |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Auth            | Signed install and launch                                          | PASS, prior devicectl installation and owner use                               |
| Auth            | Fresh-install clean-storage behavior                               | PENDING; installation does not prove cleared Keychain                          |
| Auth            | First login                                                        | PASS, Anas signed into physical app                                            |
| Auth            | Logout and login again                                             | PENDING physical                                                               |
| Auth            | Expired session                                                    | PENDING physical                                                               |
| Auth            | Background/resume                                                  | PASS sampled push return; broader expiry/resume pending                        |
| Auth            | Force-close/relaunch                                               | PASS notification cold launch restores session                                 |
| Navigation      | Home                                                               | PASS sampled physical                                                          |
| Navigation      | Schedule tab                                                       | PENDING current signed-device matrix                                           |
| Navigation      | Availability tab                                                   | PENDING physical                                                               |
| Navigation      | Hours tab                                                          | PENDING physical                                                               |
| Navigation      | Profile tab                                                        | PENDING physical                                                               |
| Navigation      | Station switcher                                                   | PENDING manual selection; push station routing passed                          |
| Navigation      | Notification link to Curdani                                       | PASS background and cold tap                                                   |
| Navigation      | Pending destination after a new login                              | PENDING; restored session is different                                         |
| Schedule        | Published week                                                     | PENDING physical release QA                                                    |
| Schedule        | Unpublished/empty state                                            | PENDING physical                                                               |
| Schedule        | Overnight shift                                                    | PENDING physical; automated time tests pass                                    |
| Schedule        | Next shift                                                         | PENDING physical release QA                                                    |
| Schedule        | Detail sheet                                                       | PENDING physical                                                               |
| Availability    | Edit day/custom hours/save                                         | PENDING each; isolated test account required                                   |
| Availability    | Failed save/dirty-state protection                                 | PENDING each; do not alter real employee availability                          |
| Hours           | Week/month/custom range                                            | PENDING each                                                                   |
| Hours           | Correction visibility                                              | PENDING physical                                                               |
| Hours           | Active excluded from totals                                        | PENDING dedicated fixture confirmation                                         |
| Hours           | Overnight entries                                                  | PENDING physical; automated regressions pass                                   |
| Push            | Permission grant                                                   | PASS iOS granted state and generated Expo token                                |
| Push            | Foreground                                                         | PASS receipt ok and owner saw in-app update; no duplicate OS banner intended   |
| Push            | Background                                                         | PASS receipt ok, notification appeared and opened Curdani                      |
| Push            | Terminated                                                         | PASS receipt ok, tap restored login and opened Curdani                         |
| Push            | Inbox/read                                                         | PASS tapped rows have read_at; merely displayed foreground row remained unread |
| Push            | Denied / later enabled in Settings                                 | PENDING physical, separately from initial grant                                |
| Push            | Actual schedule-published target                                   | PENDING; no published Curdani schedule available during push test              |
| Push            | Actual upcoming-shift target                                       | PENDING physical                                                               |
| NFC             | Actual tag / cold / foreground / background                        | PENDING each; owner away from tag                                              |
| NFC             | Check-in/check-out/duplicate tap                                   | PENDING each; dedicated test attendance required                               |
| NFC             | Offline/outside radius/wrong station/invalid token                 | PENDING each physical                                                          |
| Location        | When-in-use / Always                                               | PENDING each physical                                                          |
| Location        | Precise off / permission downgrade                                 | PENDING each physical                                                          |
| Location        | Enter / exit while ACTIVE                                          | PENDING each; owner away from station                                          |
| Location        | Background / terminated delivery                                   | PENDING each; OS timing is not deterministic                                   |
| Location        | Logout cleanup                                                     | PENDING physical; implementation/tests are supporting evidence                 |
| Location        | No automatic attendance mutation                                   | Code architecture verified; physical scenario pending                          |
| Left-open       | Seeded test notification tap                                       | PASS active attendance target; no attendance changes                           |
| Left-open       | Actual threshold creation/delivery                                 | PENDING; seeded test did not qualify the threshold                             |
| Left-open       | Checkout invalidation                                              | PENDING physical, use isolated fixture                                         |
| Account switch  | A logout → B login, inbox/unread/station/NFC isolation             | PENDING all; second test identity needed                                       |
| Account switch  | Token reassociation/local reminder cleanup                         | PENDING physical; mocked/RLS tests are not physical proof                      |
| Two devices     | Registration, delivery, one-device logout, invalid token isolation | PENDING, no second phone                                                       |
| Universal links | Installed app / browser fallback / production ID                   | PENDING and blocked by associations                                            |
| Android         | All physical scenarios                                             | PENDING, no Android phone                                                      |

For geofence tests record build, permission/precision, app state, approximate entry/exit time,
approximate reminder delay, and attendance state. Do not change timing architecture to compensate
for normal OS delays. No automatic check-in/out should occur. Do not uninstall the owner's only
working build merely to test fallback; use dedicated test hardware when available.

## iOS identity, signing and TestFlight

Apple portal inspected read-only: only **YellowShifts Development — il.co.darb.yellowshifts.dev**
is registered. App Store Connect Apps page says **No Apps**. No records were created.
Apple APNs key 7W54HZT332 is Team Scoped, Production, team KHQ29Z6A7S. The dev EAS assignment
and successful receipts are verified. Production bundle assignment is not yet qualified.

Existing Distribution certificate/private key and Ad Hoc profile remain untouched. The dev profile
cannot sign `il.co.darb.yellowshifts`. Do not upload the existing Ad Hoc IPA to TestFlight.

Production preparation, manual external steps:

1. Apple Developer > Identifiers > + > App IDs > App: description YellowShifts, explicit ID
   `il.co.darb.yellowshifts`. Enable Push Notifications; enable Associated Domains when preparing
   the reviewed NFC-capable release. Do not enable unrelated capabilities.
2. Profiles > + > Distribution > App Store Connect: select the production App ID and existing
   valid Apple Distribution certificate. Name `YellowShifts App Store`, generate/download.
   Keep it ignored. Do not create/revoke another certificate just for the production bundle.
3. EAS credentials for production: decline Apple login; supply existing distribution certificate
   and the NEW matching store profile through manual credential upload. Do not upload the local
   dev `credentials.json` as production credentials. Reuse the existing APNs key for production
   through the existing-key menu, not key rotation.
4. App Store Connect > Apps > +: iOS, name YellowShifts, primary language Hebrew (proposed for
   current Hebrew-first UI, owner approval needed), production Bundle ID, SKU `yellowshifts-ios`.
   User access: appropriate internal team. No app record creation authorized in this phase.
5. Resolve policy/assets and review the release gates below before a build. Store distribution
   uses `production`; `preview` is internal Ad Hoc and is NOT a TestFlight profile.

Configuration evidence:

- Name YellowShifts; marketing version 1.0.0; remote build numbering and autoIncrement for release.
  No production counter reset; final number must be verified on the generated artifact.
- Generated local iOS project deployment target 16.4. Verify again on final clean native build.
- Tablet support enabled: iPad QA and appropriate screenshots are pending.
- Standard foreground location copy exists. Background copy/mode depends on the guarded flag.
- Export-compliance answer is not explicitly configured; owner must assess encryption use and
  complete Apple's questionnaire. Do not assert an exemption as a guess.
- Privacy/support URLs not configured or identified as published product policies.
- No new signed release candidate built: production App ID/profile and store record are missing.

Important CLI discovery: selecting preview in the credentials menu resolved `.dev` unless the
shell explicitly set EAS_BUILD_PROFILE. Always set it for identity-sensitive commands below;
verify the identifier printed before uploading anything.

## Universal links, NFC and AASA

Live GETs on both `paz.darb.co.il` and `paz-shifts.vercel.app`:

- `/` responds 200.
- `/.well-known/apple-app-site-association`: 503, association configuration pending.
- `/.well-known/assetlinks.json`: 503, association configuration pending.

Repo routes in apps/web/app/.well-known are structurally guarded. AASA accepts only explicit
app IDs and emits `/nfc/*`, not all routes. Planned public web environment value:

```text
APPLE_APP_IDS=KHQ29Z6A7S.il.co.darb.yellowshifts.dev,KHQ29Z6A7S.il.co.darb.yellowshifts
```

This is public association data, not a secret. Verify the application-identifier entitlement of
both final profiles, then configure each intended web deployment and deploy only with approval.
No DNS change required. Apple caching means a 200 document alone still needs installed-device QA.
Android uses ANDROID_APP_LINKS_PACKAGE and ANDROID_APP_LINKS_SHA256; obtain real signing
fingerprints first. Current helper supports one package per configured document. Do not invent
fingerprints or claim both dev/prod Android associations are configured.

Canonical tag shape: `https://paz.darb.co.il/nfc/<opaque-token>` (legacy intended host also supported).
No raw station token is included here. A tag already using a supported canonical URL need not be
rewritten solely for native support. Exact actual tag contents and web fallback remain unverified.
The server decides attendance after authenticated membership/location checks and worker confirmation.

## Scheduler readiness

Existing endpoint: POST `/api/internal/notifications` on the ADMIN deployment, not the worker web
host unless routing has explicitly mapped it. Confirm actual admin deployment URL before use.
No cron configuration was found in the repo; external scheduler existence cannot be inferred.
Required environment: NOTIFICATIONS_ENABLED=true, NOTIFICATIONS_CRON_SECRET (secret), server-only
Supabase URL/service role; EXPO_ACCESS_TOKEN if Expo push access security is enabled.
Constant-time Bearer authentication is present. Public requests without valid auth are rejected.

Execution: trusted scheduler every minute → claim_worker_notifications → LEFT_OPEN wrapper →
schedule claim; advisory transaction lock 9131901, unique event/device keys and bounded claims.
Receipt checks after 15 minutes; missing receipts back off with 23-hour deadline. Explicit throttling
can retry with 5-minute backoff/max 3 attempts; ambiguous sends become uncertain instead of duplicating.
Migration 23 fixes station clock interpretation. Local SQL evidence covers 30/60/off, stale edits,
expiry, dedupe and DST. No automatic hosted scheduler run is qualified by those tests.

Activation runbook (PREPARED ONLY; broad production delivery requires explicit approval):

1. Select a separate test backend and admin deployment with migrations 1–23 and dedicated users.
2. Configure the secret in server/scheduler secret managers, never the mobile environment.
3. Publish test assignments and set 60/30/off preferences; use station-local starts in the matching
   window. Re-run, edit/remove assignments, and verify no stale or duplicate deliveries.
4. Test LEFT_OPEN with isolated attendance and test-only threshold, then checkout/correct it and
   verify eligibility ends. Do not change production thresholds or real attendance.
5. After qualification, authorize the intended production recipient scope, configure every-minute
   POST, monitor accepted tickets/receipts/failures and stop through NOTIFICATIONS_ENABLED=false.
   Publication must continue succeeding independently of push delivery.

Manual request template, for approved test endpoint only:

```sh
curl --fail-with-body --request POST "$NOTIFICATIONS_ENDPOINT" \
  --header "Authorization: Bearer $NOTIFICATIONS_CRON_SECRET"
```

No real endpoint/secret is embedded. Never point the disposable SQL fixture scripts at hosted data.

## Privacy and Data Safety evidence map

This is a technical inventory, not a submitted Apple/Google declaration or legal policy.
No ad SDK/cross-app tracking identified. All identity-linked data needs honest disclosure; provider
processing is not automatically exempt from store collection/sharing definitions.

| Data                         | Actual flow / collection                                                | Linked / purpose                                                    | Retention and processors                                                                                |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Account ID/email/phone       | Auth and profile records in Supabase                                    | Yes; sign-in and account functionality                              | Server retained; deletion/backups policy unresolved                                                     |
| Worker name/profile          | Profile data fetched by app                                             | Yes; identify worker                                                | Supabase; employer/operator access by authorization                                                     |
| Station membership           | Server membership/role/status                                           | Yes; access control and station context                             | Supabase; retention policy unresolved                                                                   |
| Schedule/assignments         | Server schedules shown in app                                           | Yes through assignment; work planning                               | Supabase; formal retention unresolved                                                                   |
| Availability                 | Worker edits sent to server                                             | Yes; scheduling                                                     | Supabase; formal retention unresolved                                                                   |
| Attendance/corrections       | Confirmed attendance records/server audit                               | Yes; attendance and reports                                         | Supabase; employment retention/deletion obligations need owner decision                                 |
| Work hours                   | Derived from attendance, displayed in app                               | Yes; reporting                                                      | Derived local views + retained server source; no native payroll feature                                 |
| Expo token                   | Native APNs token exchanged with Expo; Expo token registered on server  | Yes via worker_devices; notifications                               | Supabase/Expo/Apple; logout/null-token cleanup, stale-device cleanup after 30 days when dispatcher runs |
| Installation ID/proof        | SecureStore and hashed proof on server                                  | Yes via device row; safe registration                               | SecureStore/Supabase; row/session cleanup; Keychain can persist beyond uninstall                        |
| Precise location             | Scan-time fix sent to authenticated NFC RPC                             | Linked request; station-presence validation                         | No worker route-history table identified; request/gateway/provider logging retention must be verified   |
| Approximate location         | OS may supply coarse/denied precision; precise requirement checked      | Permission/validation behavior                                      | Do not declare precise data never transmitted; inspect actual logs/policies                             |
| Geofence events              | OS/local tasks, station coordinates, local reminders and bounded caches | Account-bound optional reminder functionality                       | Device-local; cleanup on logout. No continuous trajectory uploaded                                      |
| Inbox/preferences/read state | Server rows                                                             | Yes; notification functionality                                     | Supabase; formal retention unresolved                                                                   |
| Diagnostics                  | Dev-only stage/result logs; server delivery summaries                   | Operational purposes; infrastructure logs may identify sessions/IPs | No crash analytics SDK found; hosting/Supabase/Expo/Apple retention review pending                      |

No in-repo privacy policy route/text or verified support URL/contact found for the product.
Existing landing URLs respond 200; they are not substitutes for a privacy policy.
`founder@darb.co.il` is the known Apple account address, not automatically an approved support mailbox.
Do not invent /privacy or /support links in store metadata until published and checked.

Required policy topics: controller/employer roles, contact, account and work data, attendance and
corrections, scan-time location, optional background reminders, push identifiers, consent withdrawal,
account/deletion requests, employment-record retention, backups, inbox/device retention, security,
Supabase/Expo/Apple and hosting processors, international transfers, children/eligible workforce.
No legal text rewritten. Retention values/provider contracts need owner review.

## Assets

Only assets/logomark.png found as app icon/splash source: 1254×1254, alpha channel present.
This is existing brand art, not a newly approved store asset. Produce/approve final opaque iOS icon
and verify the generated asset before upload. No new artwork generated.
Android adaptive foreground/background, monochrome launcher icon and dedicated notification icon
are not explicitly configured. Default fallbacks do not constitute visual QA.
Splash configured gold #FCBC00 with logomark width 96. Final production cold-start appearance pending.
No final store screenshot set identified. Capture Hebrew iPhone and supported iPad layouts from safe
review data; Android screenshots after signed-device QA. Do not use real employee information.

## Android and Play preparation

EAS read-only: no credentials for il.co.darb.yellowshifts.dev or il.co.darb.yellowshifts.
No google-services.json or Firebase service-account JSON/keystore in mobile credentials or Downloads.
Firebase console project/app existence not verified; do not infer no Firebase project exists anywhere.
No usable Java runtime or Android SDK on this Mac. Native Android compilation remains BLOCKED,
not passed by Hermes export. No Android phone available. No signing fingerprint established.

Exact external setup sequence:

1. Firebase console: select intended project; register Android app with exact package
   il.co.darb.yellowshifts (and separate .dev app if dev push testing is needed).
2. Download google-services.json into ignored credentials directory. Supply GOOGLE_SERVICES_JSON
   as EAS file variable for the appropriate environment; current app.config already consumes it.
3. Obtain appropriately authorized FCM v1 service account; save JSON locally/secret storage, never
   track or add to EXPO_PUBLIC values. EAS credentials > Android > Google Service Account > FCM v1
   upload for the matching application. Do not use legacy API keys.
4. EAS credentials > Keystore: reuse an existing valid keystore if one is found in Play/company
   records; otherwise deliberately generate a new one. Back it up securely. Do not blindly replace.
5. Obtain certificate SHA-256 from the actual signing key. For Play builds use Play App Signing
   certificate (may differ from upload/internal APK key). Configure assetlinks with the real value.
6. Build preview APK for direct internal install. Production build produces store AAB by default;
   review generated metadata. Signed compilation remains required before Android readiness can pass.
7. Play Console: create app with production package, enroll App Signing, configure internal tester
   email list/Google Group, upload only on explicit request. Complete content rating, Data Safety,
   privacy/support, access instructions, target SDK validation and any required permission declarations.

Keep background location off for initial guarded builds. If later enabled, Play requires an honest
core-functionality justification, prominent disclosure, permission declaration and demonstration;
optional convenience reminders may not satisfy policy. Do not weaken this explanation for approval.
POST_NOTIFICATIONS permission/channel behavior still requires Android 13+ physical QA.

## Store metadata drafts (not submitted)

App name: YellowShifts.
Primary category proposal: Business; secondary Productivity if appropriate. Final owner selection pending.
Age rating: complete current store questionnaire accurately; no chat/social/UGC/ads/gambling identified.
Do not choose a numeric rating without the questionnaire. EU trader/account agreements need owner review.

Hebrew subtitle option: המשמרות והנוכחות שלך
English subtitle option: Your shifts and attendance
Google short description: View work shifts, submit availability and manage attendance at your station.
Hebrew description:

> YellowShifts מרכזת את יום העבודה שלך במקום אחד. אפשר לצפות בסידור המשמרות,
> לשלוח זמינות ולעיין בנוכחות ובשעות העבודה. הכניסה מיועדת לעובדים בעלי חשבון
> שהוקצה על ידי מקום העבודה. יכולות דיווח בתחנה והתראות זמינות בהתאם להגדרות
> ולהרשאות. תזכורות מיקום הן אופציונליות ואינן מדווחות נוכחות באופן אוטומטי.
> English description:
> YellowShifts helps provisioned workers view their schedule, submit availability and review
> attendance and work hours. Station attendance and notification capabilities depend on the
> enabled release configuration and permissions. Optional location reminders do not automatically
> record attendance. An account supplied by your workplace is required.
> Keywords draft: shifts,schedule,attendance,availability,work,hours,משמרות,נוכחות,זמינות
> Support/privacy: pending verified public URLs and monitored support mailbox.
> Remove references to any capability disabled in the actual submitted binary. No real-time claim.

Review notes draft (adapt to actual enabled binary):

> YellowShifts is a worker scheduling and attendance app. Workers use provisioned accounts.
> A station NFC tag opens an HTTPS URL; the tag does not identify the worker. The app validates
> the signed-in account and station membership, obtains scan-time location, and requires worker
> confirmation before the server records attendance. Optional geofencing only gives arrival/exit
> reminders; it does not continuously track routes or automatically check workers in/out.
> There is no face recognition or QR attendance. Reviewer credentials and an isolated test station
> will be supplied through App Review Information. Location-dependent attendance requires an
> agreed review arrangement; no production authorization or location bypass is provided.

## Reviewer and physical test strategy

Anas/Curdani are NOT a dedicated reviewer dataset; active real attendance exists. Never submit that
password/account as review credentials or copy it into documentation. Admin must provision a separate
review worker and second QA worker, an isolated station, safe week/overnight assignments, availability
and completed/active test attendance. Use a separate test backend if practical. Provision a test NFC
tag/token through normal admin controls, keep it out of public reports, and agree a legitimate location
for reviewer attendance validation. Supply credentials only in store review access fields/secure channels.
Do not invent a geofence bypass. A screen recording can explain hardware flow but is not a substitute
for adequate reviewer access. Do not create fake production records automatically.

Account-switch script once QA identities exist: A login → foreground push → unread inbox → pending NFC
intent (no mutation) → logout → B login. Verify zero A unread/inbox/context/intent, correct device owner,
no A notification delivered to B, local reminders removed. Repeat A login. Second-device script: same
worker two installations → both receive → logout one → other remains registered; invalidate only the
fixture token on one, verify other works. Neither script has been claimed physically passed.

## Release guards

| Guard                                   | Current preview/production | Decision                                                                                                                                             |
| --------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote push                             | false/false                | Dev qualified; keep unchanged until production App ID/APNs association and isolated release QA. Then explicitly enable only internal candidate first |
| Native NFC associations                 | false/false                | Keep off: live AASA/assetlinks 503, real-tag QA pending                                                                                              |
| Background location                     | false/false                | Keep off: physical and store-policy qualification pending                                                                                            |
| Scheduler                               | Server opt-in              | No broad activation; external schedule not verified                                                                                                  |
| Auth/session/membership/location checks | Enforced                   | Keep; no review bypass                                                                                                                               |

No guards changed in this phase. Local development notification flag remains true from Phase 5.5.
A flag enabled only in local .env does not prove a production profile has it enabled. TestFlight build
must be reviewed for intended capability scope; current guarded production would omit push integration.

## Commands and validation

Completed in this phase:

- Git fetch/status/history review; Supabase migration list (read-only).
- Mobile tests 152/152; root regressions 90/90; mobile typecheck/lint; diff check.
- Expo Doctor 21/21.
- iOS and Android production Hermes exports with all three release gates explicitly false.
- check:bundle: both source maps pass; no known privileged local values found in export.
- No new native compile, signed release artifact, TestFlight upload or Play upload.
  Prior signed development iOS build remains the verified native artifact.

Reproducible candidate commands AFTER prerequisites are resolved, from mobile directory:

```sh
cd /Users/zangeel/Documents/GitHub/PazShifts/apps/mobile
EAS_BUILD_PROFILE=production pnpm dlx eas-cli@24.3.0 credentials --platform ios
EAS_BUILD_PROFILE=production pnpm dlx eas-cli@24.3.0 build --platform ios --profile production
EAS_BUILD_PROFILE=preview pnpm dlx eas-cli@24.3.0 credentials --platform android
EAS_BUILD_PROFILE=preview pnpm dlx eas-cli@24.3.0 build --platform android --profile preview
```

Verify production ID printed in each identity-sensitive command. Decline Apple login and use matching
manual credentials. Commands contain no --auto-submit. Do not use npx testflight: it uploads automatically.
Production iOS .ipa is suitable for later TestFlight upload only after store signing/metadata validation.
Preview Android APK is for direct internal installation, not the Play AAB upload track.
For a later Play AAB, build --platform android --profile production after credential/config readiness.
No submission command is authorized or executed here.

Safe commit for this phase's report only (existing product edits deliberately separate):

```sh
cd /Users/zangeel/Documents/GitHub/PazShifts
 git add apps/mobile/PHASE9.md
 git diff --cached --stat
 git commit -m "Document Phase 9 release qualification and blockers"
```

Inspect staging first if other changes are already staged. No push command executed.

## Go/no-go and next actions

NO-GO now. Priority: commit/review omitted timezone changes; register production Apple ID and store
profile/app record; approve assets/privacy/support/reviewer setup; restore public associations only
through approved deployment; qualify isolated physical NFC/location/account switch and scheduler;
configure Android signing/FCM and obtain native build/device evidence. Reassess guarded release scope
rather than claiming missing features are qualified. No new migration required.

Sources checked during this audit:

- https://docs.expo.dev/submit/testflight/
- https://docs.expo.dev/build/internal-distribution/
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- https://developer.apple.com/go/?id=info-1
- https://support.google.com/googleplay/android-developer/answer/9799150?hl=en
