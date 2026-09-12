# Mobile Phase 3

## Delivered

Schedule uses a seven-day native strip, chronological week buttons and RTL-aware header swipes. Selected weekday is preserved between weeks; Home links to the next shift's date. Published-but-empty, unpublished, free-day and no-future-shift states are distinct. Assigned shifts include template, station, duration, overnight explanation, visible coworkers and notes in a dismissible sheet. Schedule revalidates on focus and manual refresh; obsolete station/week results are discarded.

Availability uses the existing three modes, seven day rows, native time selection, overnight windows, a reversible all-available shortcut and a fixed save action above the tab bar. Dirty week/tab/station/back navigation offers save/discard/cancel. Failed saves retain the draft; success comes only from the RPC result. Current week through two weeks ahead is editable. Week/day notes already stored on the server are preserved. There is no offline queue.

The same-account foreground auth check keeps the mounted editor while revalidating; failed verification still clears private context. Identity changes and logout still unmount it. Drafts are memory-only and do not survive process termination or revoked access. Home availability links now open native Availability. Hours and Profile retain Phase 2 functionality.

## Native boundaries and dependencies

- `src/week`: Schedule, Availability, WeekPicker, Sheet, pure draft/date helpers, and a small injectable read/save API for isolated previews.
- `packages/database/src/mobile-week.ts`: `getMobileWorkerSchedule`, `getMobileAvailabilityWeek`, `saveMobileAvailability`; every helper validates identity and active station membership before existing RLS-backed queries. Schedule reads are bounded to one week/301 rows with explicit overflow failure and published filtering. Only own assignments are returned; coworker details are names/roles, not contact records.
- Added `@react-native-community/datetimepicker` 9.1.0, selected by Expo SDK compatibility, with its config plugin. Rebuild the development client (`pnpm --filter @yellowshifts/mobile ios`); Metro reload alone cannot install a native module. No new environment variables.
- `tests/visual/Preview.tsx` provides isolated 320/390/430-point fixtures and mixed/empty/unpublished/all/error states. Its temporary development route was removed after QA; fixtures are absent from release bundles. See `tests/visual/README.md` to reproduce locally.

## Migration and RPC contract

Migration: `supabase/migrations/20260913000018_atomic_worker_availability.sql`.

```sql
public.submit_worker_availability(
  p_station_id uuid,
  p_membership_id uuid,
  p_week date,
  p_entries jsonb,
  p_notes text DEFAULT NULL
) RETURNS jsonb
```

Each of exactly seven entries has `date`, `availabilityType`, optional `startTime`, `endTime`, `notes`. Days must uniquely cover the requested Monday–Sunday week. Time windows require valid unequal 24-hour times; overnight is supported by the existing constraint. Server station timezone determines the allowed current/+1/+2 weeks. `auth.uid()`, active profile/station and own active membership are checked. No admin override permits writing another worker's availability.

`SECURITY INVOKER`, fixed search path, authenticated-only execute grant; no service-role client, new table, column, RLS change or constraint removal. A transaction-scoped advisory lock serializes this RPC's submissions for the membership. Week upsert, replacement entries and returned `{week, entries}` are one transaction. Any exception, including an insert-trigger failure, rolls back the week metadata and all entries.

Shared `saveWeeklyAvailability` now calls this RPC once and maps the response to its unchanged public return type. The existing web `saveWorkerAvailabilityAction` and new mobile saver both benefit. There is deliberately no fallback to the previous delete/insert request sequence.

**Apply the migration before deploying/pushing code that automatically deploys the new web caller.** Otherwise availability saving will report an error until the RPC exists. No production migration was applied during this task.

Inspect from the repository root:

```sh
cat supabase/migrations/20260913000018_atomic_worker_availability.sql
```

When ready, set `SUPABASE_DB_URL` locally to the intended database connection string, verify its project, then manually run:

```sh
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260913000018_atomic_worker_availability.sql
```

Alternatively paste that file's complete contents into Supabase SQL Editor. The migration wraps itself in BEGIN/COMMIT. It takes a function-definition lock and does not rewrite business tables; submissions take normal row locks and a membership advisory lock. No worker data is modified by merely installing the function.

Rollback: revert callers before removing the function; leaving the unused function installed is safe. Removing it while new callers remain deployed breaks saving. Reverting to the old caller also restores its known non-atomic behavior. No stored availability format needs conversion.

## Verification

Passed: 40 mobile tests, 65 existing regressions, workspace typecheck/lint/format, both web/admin builds, Expo Doctor 21/21, and iOS/Android Hermes exports. iOS development-client compilation succeeded.

Commands used:

```sh
pnpm --filter @yellowshifts/mobile test
node --test tests/*.test.mjs
pnpm typecheck
pnpm lint
pnpm format
pnpm build
pnpm dlx expo-doctor apps/mobile
pnpm --filter @yellowshifts/mobile exec expo export --platform ios --platform android --source-maps
```

The SQL integration tests use a disposable local PostgreSQL database, real availability tables/constraints/RLS and an authenticated role. They test replacement, resubmission, invalid/duplicate/missing/extra days, invalid times, historical/future weeks, another worker, unauthorized station, inactive membership, missing authentication and injected failure after deletion. Every failure preserves the previous complete submission. Fixtures are rolled back. Auth.uid is locally stubbed from a session setting; this is not a hosted Supabase Auth test.

To reproduce locally only, choose a **new disposable database name**:

```sh
createdb -h /tmp paz_availability_test
psql -h /tmp -d paz_availability_test -v ON_ERROR_STOP=1 -f tests/sql/availability-bootstrap.sql
for file in supabase/migrations/2026090600000{1,2,3,4,5}*.sql; do
  psql -h /tmp -d paz_availability_test -v ON_ERROR_STOP=1 -f "$file" || break
done
psql -h /tmp -d paz_availability_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260913000018_atomic_worker_availability.sql
psql -h /tmp -d paz_availability_test -v ON_ERROR_STOP=1 -f tests/sql/atomic-availability.sql
```

Never run bootstrap/fixture scripts in a production database. They implement the relevant identity/schedule/availability schema subset, not the hosted Auth service.

Simulator QA uses iPhone 17 Pro and Pro Max / iOS 26.5 and isolated width-constrained previews. Native picker timezone behavior, overnight sheet, selected modes, dirty confirmation, save pending/failure/success and sticky save placement were manually inspected. No real availability or schedule was changed. Physical haptics, full VoiceOver/TalkBack walkthroughs and Android native runtime remain unverified; Android Hermes export is not an emulator test. No measured under-30-second task completion claim is made.

## Next phase

Recommend Phase 4: native Hours with the existing authoritative calculations and export semantics, after applying and verifying this migration and testing Phase 3 on a physical phone. Notifications/location/NFC remain outside this change.
