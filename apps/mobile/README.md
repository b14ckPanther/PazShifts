# YellowShifts mobile

Native Expo foundation. Existing worker/admin websites and NFC links remain supported and unchanged. No database migrations, production mutations, new accounts, push delivery or background location are included in this phase.

## Architecture

- Expo SDK 57.0.22, React Native 0.86.3, React 19.2.3; mobile TypeScript 6.0.3. Node >=22.13 and the repository's pnpm 11.24.0. Web dependency versions remain unchanged.
- Expo Router: `app/_layout.tsx` owns fonts, native providers and stack; `(auth)/login.tsx` is the native login; `(app)/_layout.tsx` guards the authenticated five-tab shell; Home presents real worker data and the three workflow tabs provide honest summaries plus links to the existing website.
- `src/ui`: Screen (safe area, keyboard, scrolling), Label (Heebo/Ubuntu), Surface, Button (Reanimated press spring, reduced-motion and haptics), Field (focus), Message and Skeleton.
- `src/ui/theme.ts`: existing yellow/crimson/cream/light surface tokens. Hebrew-first layout via expo-localization native RTL configuration; separate LTR inputs for email/phone/password and English typography. Only five required font weights and individually imported Lucide icons are bundled, available offline. Exported Hermes bundle sizes fell from approximately 6.4 MB iOS / 6.6 MB Android with barrel imports to 3.6 MB / 3.8 MB after narrowing imports (local production exports; this is a bundle-size comparison, not a device latency benchmark).
- `packages/database/public.ts`: explicit mobile-safe entry. Exposes pure identifier normalization, a read-only native worker-context helper and types. Does not re-export the existing root, SSR, middleware, admin factories or server configuration. Existing entry points are untouched.
- No persistent private presentation cache. Fresh identity, active profile and station membership reads precede the account screen. Context is discarded on logout and obsolete requests cannot replace a newer session's context. App foregrounding revalidates and starts token refresh; backgrounding stops refresh.

## Authentication and storage

Same Supabase email/password and normalized phone/password credentials as web. No passwords stored. Supabase uses `processLock`, native refresh and a SecureStore adapter. Two bounded chunk slots publish a manifest after the complete value is written. This handles sessions larger than older iOS Keychain value limits, preserves the previous complete value on partial writes and deletes readable/session fragments on logout. Native storage errors surface as errors, never a plaintext fallback. Keychain uses WHEN_UNLOCKED_THIS_DEVICE_ONLY; biometric prompts are not required for refresh. iOS Keychain may survive reinstall; identity is still checked on restoration.

Logout uses Supabase local-session scope (other devices remain signed in); errors remain visible. Network waits are bounded to 15 seconds per request without custom retries. RLS remains authoritative; the displayed membership list is not an authorization cache.

The `yellowshifts` custom scheme is registered. Phase 1 return targets are restricted to `/`, the only implemented authenticated destination. Unknown routes have a native fallback. Do not distribute native NFC links yet: the native attendance route belongs to Phase 7. No universal-link associations or existing HTTPS routing were modified.

## Local setup

From the repository root:

```sh
pnpm install
cp apps/mobile/.env.example apps/mobile/.env.local
```

Set only these public values for the existing Supabase project (or an isolated test project):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Never put service-role keys, account passwords or NFC tokens in Expo environment variables. Missing configuration produces a visible setup message and disabled login. Vercel environment settings are not automatically copied into native builds.

```sh
pnpm --filter @yellowshifts/mobile ios
pnpm --filter @yellowshifts/mobile android
pnpm --filter @yellowshifts/mobile dev
```

Use development builds, not Expo Go. Generated `ios/`, `android/`, `.expo/` and exported bundles are ignored. Config plugins regenerate native projects. Xcode 26.4+ is required by SDK 57; Android setup requires the compatible Android SDK/JDK. Current Expo support floor is iOS 16.4 and Android 7.

## EAS / signing

`eas.json` profiles:

- `development`: internal iOS simulator development client.
- `development-device`: physical-device development client.
- `preview`: internal distributable build.
- `production`: release build, with explicit identity configuration required.

Default `il.co.darb.yellowshifts.dev` identifiers are local development placeholders, not registered production identities. Before signed builds, confirm the bundle/package IDs and Expo account/project ownership. Configure these build-time values (not secrets):

```dotenv
MOBILE_IOS_BUNDLE_ID=CONFIRMED_BUNDLE_ID
MOBILE_ANDROID_PACKAGE=CONFIRMED_ANDROID_PACKAGE
EAS_PROJECT_ID=EXISTING_OR_OWNER_CREATED_PROJECT_UUID
```

Apple team/provisioning profiles and Android signing credentials must be supplied through the owner's approved signing setup. No project, paid service, signed cloud build or store submission was created automatically. Production config rejects missing explicit IDs/project. No push/geofence permissions are requested in Phase 1.

## Verification

```sh
pnpm --filter @yellowshifts/mobile test
pnpm --filter @yellowshifts/mobile exec expo install --check
pnpm dlx expo-doctor apps/mobile
pnpm --filter @yellowshifts/mobile bundle
pnpm typecheck
pnpm lint
pnpm format
pnpm build
node --test tests/*.test.mjs
```

The 17 native unit tests use isolated in-memory storage and mocked transport/database clients and a mocked React/AppState harness: large Unicode sessions, atomic fill failure, rotation/logout, corrupt storage, identity switching, active membership filtering/revocation, database errors, bounded fetch and safe return paths. They do not claim hosted Auth or device Keychain verification.

During implementation, Expo Doctor passed 21/21 checks; both iOS and Android Hermes exports passed. Source maps were inspected to confirm no Next.js, Supabase SSR or privileged shared modules entered either native bundle. Existing 65 regression tests, web/admin production builds, workspace typecheck/lint and formatting passed. Existing ESLint 9 / @eslint/js 10 peer warning and Next middleware deprecation remain unrelated; no checks were disabled.

iOS development-client binary built successfully with Xcode 26.6 (two native build warnings, no errors) and ran on an iPhone 17 Pro simulator / iOS 26.5. Visually verified Hebrew alignment, email/phone selection, focus styling, software-keyboard Next transition, password visibility, scrolling and the inline footer. A discovered RTL alignment issue was corrected in the native Label primitive. No physical-device, hosted-login or native Keychain round-trip claim is made: no test Supabase credentials were configured.

Android native project generation and Hermes export passed; Android SDK/adb is not installed here, so no Android binary/emulator check was possible. EAS cloud builds and store distribution remain unrun. pnpm also reports an Expo log-box transitive React-DOM peer warning (19.2.8 versus the SDK-matched native React 19.2.3); Expo Doctor and the actual iOS build/runtime pass. Web React remains 19.2.8. No peer checks were suppressed.

## Phase 2 — worker experience

Implemented two-screen onboarding, five Hebrew tabs (Home, Schedule, Availability, Hours, Profile), contextual Home, station sheet and useful workflow previews. Existing login, fonts, native session storage and NFC/web behavior remain intact. No schema changes or additional environment variables are needed.

### Data and state

- `src/home/WorkerProvider.tsx` owns one station selection and one shared Home read for all tabs. A sole active station is selected automatically; multiple memberships expose the native sheet. Selecting the same station is a no-op. Generation/cleanup guards discard obsolete station responses. Signing out unmounts the provider and clears presentation data.
- `packages/database/src/mobile-home.ts`, exported only through the public boundary, freshly validates identity/profile/membership before every read. Four independent reads then run concurrently: own published assignments, own active attendance, next-week availability and own station attendance overlapping this week. All use the existing user Supabase client and RLS.
- Assignments cover the current week through 28 days ahead; attendance covers the current local week. Lists fetch at most 301 rows and fail visibly above 300 instead of silently calculating incomplete totals. Existing report `buildEntries` supplies timezone/day splitting, overlap and confirmed-hour semantics; open/flagged rows are excluded. These are attendance hours, not payroll calculations.
- Own active attendance is checked across stations so station switching cannot hide that the worker is already clocked in. Its station timezone is used when available. No attendance writes or security decisions use the Home preview.
- Refresh runs every 60 seconds only while foregrounded, plus manual refresh. Shared data survives tab changes; refresh preserves same-station content until success/error. A failed read clears stale presentation and exposes retry. There is no disk/private cross-user cache, Redis or new global state library. Active elapsed time updates in its own component; Home does not rerender every second.
- Onboarding completion is the local SecureStore value `ys.onboarding.v1=complete`; saving must succeed before entering Home. Skip follows the same path. It is installation-scoped, not per-account; Keychain may survive reinstall. No permissions are requested.
- Schedule/availability/hours links explicitly open the existing `https://paz.darb.co.il/stations/{code}` website. Website authentication remains separate; native credentials are never added to URLs.

### Design

Cream/yellow contextual hero, compact weekly metrics, a single availability action when missing, and attention only for open/review attendance. Authoritative active attendance outranks scheduled states. Time ranges use compact LTR HH:mm; live elapsed duration retains seconds. The five-tab bar honors bottom insets, selected semantics and selection haptics. Onboarding/hero transitions and station-sheet/tab motion respect reduced motion. Profile includes actual contact details, roles, memberships, version and existing logout.

### Phase 2 verification

- 32 mobile tests passed: all 17 Phase 1 tests plus Home priority/empty states, query scope/bounds/failures, station changes and delayed responses, persisted onboarding completion/write failure, shell routing, tab events/accessibility and single/multi-station picker semantics. Database/React tests are mocked; they do not replace hosted RLS integration tests.
- Existing 65 web/admin regression tests passed. Workspace typecheck, lint, formatting and both web/admin production builds passed. Expo Doctor passed 21/21; Expo dependency compatibility check passed.
- iOS and Android Hermes exports passed. Export source maps contain no Next, Supabase SSR, privileged database server/admin helpers or PDF dependencies. No new native module was added.
- Existing iPhone 17 Pro / iOS 26.5 development client verified onboarding, actual active-attendance Home, tab navigation, schedule/hours empty summaries, profile, RTL ordering and bottom safe area using the user's already-authenticated session. No attendance/account mutations were performed. Larger system text (`extra-extra-extra-large`) exposed English clipping, corrected with font-relative line height and rechecked; original text setting restored.
- Exact 320/390/430-width matrix, physical-device haptics, VoiceOver/TalkBack walkthroughs and Android emulator testing remain unverified. Available authenticated simulator coverage is iPhone 17 Pro; multi-station and alternative hero states use isolated automated fixtures, not fabricated runtime data. Login/keyboard behavior remains from Phase 1; it was not retested by logging out of the user's session.
- No measured two-second cold-load guarantee is claimed. Home still requires live authorization/database responses; bounded network failure shows retry rather than fabricated success. Test on the station network before release.

### Phase 2 rollback and next milestone

Revert the Phase 2 commit to restore Phase 1; no database rollback, cache flush or deployment change is needed. The local onboarding marker is harmless to Phase 1. Stop here: full native schedule/availability/hours and notification/location/NFC work belong to later phases.

## Rollback

Revert the Phase 1 commit. It adds only the mobile app, the public database entry/helper, lockfile dependencies and generated-native formatting exclusions. No production schema or web behavior needs rollback.

## References

- [Expo SDK compatibility](https://docs.expo.dev/versions/latest/)
- [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- [Supabase native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [SecureStore constraints](https://docs.expo.dev/versions/latest/sdk/securestore/)
