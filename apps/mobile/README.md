# YellowShifts mobile

Native Expo SDK 57 worker app: Home, Schedule, Availability, Hours, inbox, optional location reminders and native NFC confirmation. The existing worker website and admin app remain supported. Current release status, signed-device steps, feature gates and store/privacy gaps are maintained in [PHASE8.md](PHASE8.md).

## Architecture

Expo Router owns the native shell and login. Heebo/Ubuntu fonts are bundled offline; individual Lucide imports keep the bundle small. The explicit `@yellowshifts/database/public` boundary exposes mobile-safe RLS-backed reads and RPC callers. Shared reporting remains the only hours engine. Attendance stays server-authoritative; neither geofences nor opening a native URL writes attendance.

SecureStore stores session material and bounded account-owned pending operations; there is no plaintext session fallback, continuous tracking or offline attendance queue. Authentication is revalidated on resume. Request timeouts do not retry mutations automatically. The five tabs share Home state; overlapping startup session validations share only their in-flight promise, not a persistent authorization cache.

## Local development

Use repository pnpm 11.24.0 and Node >=22.13. Install with `pnpm install --frozen-lockfile`, copy `.env.example` to `.env.local` and configure the public Supabase URL/anonymous key for your chosen test project. Never place service-role keys, passwords or signing credentials in `EXPO_PUBLIC_*` variables.

```sh
pnpm --filter @yellowshifts/mobile dev
pnpm --filter @yellowshifts/mobile ios
pnpm --filter @yellowshifts/mobile android
```

Use a development build, not Expo Go. Generated native projects, credentials and exports are ignored. Development IDs are `il.co.darb.yellowshifts.dev`; owner-confirmed preview/production IDs are `il.co.darb.yellowshifts`. Preview and production therefore replace each other on a device. EAS project ownership remains `@millionroses/yellowshifts-worker`.

## Release controls

`eas.json` selects explicit development/preview/production EAS environments and remote build-number/versionCode management. No EAS remote version was initialized by this phase. Preview/production defaults explicitly disable remote push, background reminders and native HTTPS NFC associations until signed QA. Development retains opt-in geofencing/native NFC testing; push still requires explicit enabling.

New native build flags: `EXPO_PUBLIC_NATIVE_NFC_ENABLED`, `EXPO_PUBLIC_BACKGROUND_LOCATION_ENABLED`. Remote push retains `EXPO_PUBLIC_NOTIFICATIONS_ENABLED`. Release values are pinned in `eas.json`; change the reviewed profile entries deliberately after QA rather than assuming a remote environment overrides them. Native capabilities require rebuilding; there is no EAS Update rollout configured.

For physical development use `eas build --profile development-device --platform ios` (the `development` profile is an iOS Simulator build). Store/production builds require the final signing setup, approved assets, privacy metadata and checklist in PHASE8. No push, store upload or production scheduler is automatic.

## Verification

```sh
pnpm --filter @yellowshifts/mobile test
node --test tests/*.test.mjs
python3 tests/nfc-scans-db.py
python3 tests/staff-permissions-db.py
pnpm typecheck
pnpm lint
pnpm format
pnpm build
pnpm --filter @yellowshifts/mobile exec npx expo-doctor
EAS_BUILD_PROFILE=production pnpm --filter @yellowshifts/mobile exec expo export --platform ios --platform android --source-maps
pnpm --filter @yellowshifts/mobile check:bundle
```

SQL test scripts create disposable Unix-socket PostgreSQL clusters; they never connect to hosted Supabase. Visual fixtures live under `tests/visual` and must never be committed as application routes. Bundle inspection fails if those fixtures, SSR, admin delivery or PDF modules enter exports. Source maps are local verification artifacts, not store uploads.

Historical implementation details: [Phase 3](PHASE3.md), [Phase 4](PHASE4.md), [Phase 5](PHASE5.md), [Phase 6](PHASE6.md), [Phase 7](PHASE7.md). Phase 8 supersedes their old release identities/activation defaults and device-build commands. Existing migrations 18–21 still need owner verification on the intended backend; Phase 8 adds no migration.
