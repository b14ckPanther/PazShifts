# YellowShifts mobile — Phase 1

Native Expo foundation. Existing worker/admin websites and NFC links remain supported and unchanged. No database migrations, production mutations, new accounts, push delivery or background location are included in this phase.

## Architecture

- Expo SDK 57.0.22, React Native 0.86.3, React 19.2.3; mobile TypeScript 6.0.3. Node >=22.13 and the repository's pnpm 11.24.0. Web dependency versions remain unchanged.
- Expo Router: `app/_layout.tsx` owns fonts, native providers and stack; `(auth)/login.tsx` is the native login; `(app)/index.tsx` verifies and displays the real account/station memberships. There are no fake shift cards or unfinished navigation tabs.
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

## Next milestone

Phase 2: contextual Home, onboarding, five native tabs and a deliberate multi-station switcher. Subsequent phases add schedules, availability, hours, push devices, optional location reminders and existing authoritative NFC attendance. Do not implement these implicitly from the Phase 1 account screen.

## Rollback

Revert the Phase 1 commit. It adds only the mobile app, the public database entry/helper, lockfile dependencies and generated-native formatting exclusions. No production schema or web behavior needs rollback.

## References

- [Expo SDK compatibility](https://docs.expo.dev/versions/latest/)
- [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- [Supabase native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [SecureStore constraints](https://docs.expo.dev/versions/latest/sdk/securestore/)
