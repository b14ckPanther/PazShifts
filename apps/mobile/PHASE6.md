# Phase 6 — optional station reminders

Implementation is local and ready for signed-device testing. **Physical geofence verification is pending.** No production data/schema changes, deployment, push, or Phase 7 work were performed.

## Design and scope

- Profile contains an optional Hebrew explanation sheet and independent arrival/exit switches. There is no launch-time permission prompt or repeated nag. Permission requests progress from notification permission and When In Use to an explicit explanation before Always/background access. Denial preserves all core app functionality. Settings provides recovery.
- Preferences extend the notification experience **per account, per installation** in SecureStore. They deliberately do not alter the server push-preference schema. Other devices are independent; signing back into the same account retains its choices. No new migration or environment variable is required.
- `getWorkerReminderContext` is exported only through the explicit database public/mobile boundary. It validates identity and active memberships, reads active stations with existing latitude/longitude/radius, published assignments within seven days, and the current user's ACTIVE attendance. Reads use the authenticated Supabase client and RLS. No service role, coordinates from the worker, or ENTER/EXIT event is sent to the backend.
- `backgroundTasks.ts` registers the task at module scope. The OS monitors regions; there is no GPS watch, location polling, location history, route tracking, or attendance mutation.
- Reconciliation runs on authenticated context/foreground/station change and successful schedule loading/refresh. It compares the desired region signature before replacing the OS region set, avoiding unchanged native registrations. No new timer/background polling job exists. An event for a removed station or changed coordinates/radius stops the stale registry rather than sending from outdated geometry.
- Priorities: active-attendance station for exit reminders, then earliest upcoming published shifts, then current station. Only active authorized stations with valid coordinates/radius qualify. Maximum 20 regions on either platform. No guessed radius: the existing 30–200m station value is used unchanged.
- Arrival: a published assigned shift starts within the next two hours or started at most 30 minutes ago, and the worker has no ACTIVE attendance. Generic visits do not trigger reminders.
- Exit: a fresh authoritative read must show ACTIVE attendance at that exact authorized station. No cached ACTIVE fallback; offline/read errors skip the reminder.
- Dedupe is checked before backend reads to suppress jitter without repeated network work. Dedupe: two hours per account/station/reminder type, claimed durably before scheduling to prefer a missed reminder over duplicate delivery after ambiguous failures. The registry has a 24-hour lease renewed by reconciliation; an event after expiry stops monitoring until the app reconciles again.
- Local notifications reuse Android's `work` channel. Foreground location reminders use a quiet system banner/list entry without sound or app badge. Phase 5 remote-push banners and inbox remain separate. Taps revalidate identity/membership and open the existing Home station context, respecting unsaved-change navigation guards. They never open an unfinished NFC screen. Signed-out taps remain in the OS response until authentication; wrong-account/expired destinations are discarded.
- Logout invalidates in-flight work, unregisters regions, clears registry/dedupe and cancels/dismisses location notifications. Registry writes use the existing chunked atomic SecureStore adapter to avoid oversized keychain values. The registry contains station configuration/IDs and reminder-dedupe timestamps, **not worker coordinates or movement history**.

## Native configuration and security

Added SDK-matched `expo-location ~57.0.17` and `expo-task-manager ~57.0.17`. The location config plugin supplies Hebrew purpose strings, iOS background location and Android background location. Foreground GPS services and motion/activity permissions are disabled. No motion API is called.

Authenticated background reads require Keychain access while the screen is locked. Native session and reminder storage use `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: encrypted, device-only, not available before the first unlock after reboot. Enabling reminders rewrites an existing session through the same bounded atomic session-storage adapter to migrate its previous When Unlocked policy. No session contents are logged or placed in notification payloads. Existing refresh/revocation and RLS validation remain in force. This changes only native credential accessibility, not web/admin sessions.

Local notifications do not require Expo Push/APNs/FCM credentials or `EXPO_PUBLIC_NOTIFICATIONS_ENABLED`. Phase 5.5 is still needed for signed iOS installation/real-device verification and remote push activation. Rebuild the native binary; an older development client does not contain the new native modules. Expo Go is not a supported test target.

Geofence events are best effort. iOS limits monitoring to 20 regions; Android vendor restrictions and OS termination can prevent/delay delivery. Small station radii may be unreliable indoors even with Precise enabled; there is no guarantee of a prompt at the boundary. Approximate/reduced accuracy, missing background or notification permission, disabled services, expired registry, and inaccessible credentials all prevent reminders. Revocation is detected on foreground/reconciliation or the next event; there is no continuous permission poll.

Official references: [Expo Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [TaskManager](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/), [SecureStore accessibility](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/).

## Verification

- Mobile suite: 110 passing tests, including 39 new model/runtime/data-reader cases. Coverage includes denied/limited permissions, recovery, notification revocation, station eligibility/cap/priorities, duplicate concurrent ENTER, fresh ACTIVE exit, offline skip, expired lease, logout, account isolation, removed memberships and database failures. Existing session/shell harnesses include the new cleanup/bridge boundary.
- Existing root regressions: 75 passing.
- Workspace typecheck, lint, formatting and web/admin production builds: passed.
- Expo Doctor: 21/21.
- iOS simulator native compile: succeeded, with ExpoLocation and ExpoTaskManager linked. Generated config includes location background mode and development aps-environment.
- iOS and Android production JS/Hermes exports: succeeded, approximately 3.9 MB / 4.1 MB. Native Android compilation unavailable: no Android SDK/adb on this machine.
- Simulator: inspected isolated Profile off/on/background-denied/precise-required/notifications-disabled states at 320/390/430-point content widths, consent sheet, enlarged text and accessible dismiss action. Large-text content is intentionally scrollable; actual one-handed scrolling/VoiceOver usability still requires device QA. No fixture writes reach Supabase. Temporary preview route removed before export; fixture lives only under tests.
- These are mocked/in-process reminder tests, not real OS boundary transitions or proof of notification delivery. No SQL migration is involved.

## Remaining physical verification

On a signed **test installation**, opt in from Profile and verify each native prompt. Test precise off/on, Always downgrade, system notifications off, service off, one/two authorized stations, actual ENTER near a test assigned shift, duplicate boundary bounce, and EXIT with/without a test ACTIVE record. Verify locked/background/terminated behavior, offline skip, tap after login, logout/account switch, local notification rendering, battery impact and OS delays. Do not create real employee attendance for testing. Android still needs native build and device checks. Apple enrollment/signing remains pending; real push delivery remains Phase 5.5.

## Commands and rollback

From the repository root:

```sh
pnpm --filter @yellowshifts/mobile test
node --test tests/*.test.mjs
pnpm typecheck
pnpm lint
pnpm format
pnpm build
pnpm --filter @yellowshifts/mobile exec npx expo-doctor
pnpm --filter @yellowshifts/mobile exec expo export --platform ios --platform android --source-maps --output-dir /tmp/yellowshifts-phase6-export
pnpm --filter @yellowshifts/mobile exec expo run:ios --device B30040A8-46FD-4665-923E-6841AD79E68B --no-bundler
```

Later, with signing available, from `apps/mobile`:

```sh
pnpm dlx eas-cli build --profile development-device --platform ios
pnpm dlx eas-cli build --profile development --platform android
```

Disable both Profile location switches to unregister monitoring; system permission revocation also prevents reminders. Roll back source changes with a reviewed revert of the Phase 6 commit and rebuild native binaries. Turn reminders off before installing a rollback build. No database rollback or cloud setting is needed. Keep Phase 5.5 project linking/configuration work intact when separating commits. Phase 7 planning can proceed, but actual NFC integration and physical reminder validation are not part of this phase.

## Files

Phase 6 touches `app.config.ts`, mobile package dependencies/lockfile, root/authenticated layouts, Profile, `src/location/{model,runtime,backgroundTasks,Bridge,UI}`, native Supabase/session cleanup, the Phase 5 notification handler routing boundary, Schedule API reconciliation and the shared native sheet's optional dismiss label. Database additions are `src/mobile-location.ts` and its explicit `public.ts` export. Tests include `location.test.mjs`, session/shell harness updates and `tests/visual/LocationPreview.tsx`. Existing web/admin source and backend schema are unchanged. Some initial Phase 6 wiring/dependency edits were included in commit `784e9d6` created externally during this work; the final commit commands cover the remaining changes.
