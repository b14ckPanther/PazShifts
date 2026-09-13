# Sunday–Saturday calendar rollout

Implementation is local; no production database or deployment was changed.

## Scope

Admin scheduling, create/copy/duplicate-week controls, worker web scheduling and availability, mobile Home/Schedule/Availability, Hours calendar periods, and CSV/PDF/UI weekly grouping use Sunday–Saturday. Hebrew day labels match the actual dates. Default schedule selection uses the station-local date, including the Saturday/Sunday midnight boundary.

Existing rate-policy `weekStartsOn` values and historical classification are deliberately preserved. These are calculation rules, distinct from calendar presentation. No attendance timestamps, durations, assignments or wages are rewritten.

## Migration

`20260913000022_sunday_calendar_weeks.sql` changes the two week-start constraints and replaces `submit_worker_availability` with the same SECURITY INVOKER contract, authorization and seven-day validation, now accepting Sunday weeks. Existing migrations are unchanged.

It locks schedule/availability tables in one transaction, shifts parent week keys to Sunday and moves Sunday records into their correct destination week. Shift IDs, dates, times, assignments and per-day availability values remain intact. Source weekly notes are retained with original-week provenance. Missing availability days remain absent; web/mobile display partial availability and allow completion/resubmission. Source submission timestamps are historical provenance; complete submission requires all seven actual dates.

The migration does not enqueue publication notifications. The publication trigger is disabled only inside the transaction and restored before commit. Existing RLS, grants and attendance engines are unchanged.

If a new week would combine DRAFT and PUBLISHED source schedules, the migration **aborts and rolls back**. One weekly status cannot faithfully represent both. Resolve those publication decisions explicitly before retrying; do not bulk-publish drafts merely to pass the check. Out-of-original-week records also abort for review.

## Manual rollout

1. Take a database backup/snapshot and test its restore procedure.
2. Run the read-only preflight in Supabase SQL Editor. All result sets should be empty. Review any returned schedule IDs with the station manager.
3. Prepare matching web, admin and mobile builds. Pause schedule/availability editing during the cutover, including old mobile builds and open browser sessions.
4. Apply the migration once, then release both web apps and the matching mobile build. Reload Metro clients; installed standalone apps need an updated build. Old Monday clients are not compatible with the new constraint and must not be used for availability editing.
5. Verify Sunday 13/09/2026–Saturday 19/09/2026, Sunday shifts, copied weeks, published worker views and complete/partial availability. Resume editing after checks.

From the repository root, inspect:

```bash
less scripts/sql/sunday-weeks-preflight.sql
less supabase/migrations/20260913000022_sunday_calendar_weeks.sql
```

With your database connection set privately in `SUPABASE_DB_URL`:

```bash
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/sql/sunday-weeks-preflight.sql
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20260913000022_sunday_calendar_weeks.sql
```

Alternatively paste each entire SQL file into Supabase SQL Editor, preflight first. Do not run only the RPC name. Run the migration only once. Direct SQL application does not update Supabase CLI migration history; reconcile that history before any later `supabase db push`, rather than replaying this migration.

## Rollback

An error during the migration rolls everything back, including trigger/constraint changes. After a successful cutover, do not roll back just the application code or subtract another day from week keys. Restore the coordinated pre-cutover database backup and application versions during the maintenance window; after new writes, plan a reviewed reverse migration instead of dropping those writes.

## Local verification

```bash
python3 tests/sunday-weeks-db.py
python3 tests/nfc-scans-db.py
python3 tests/staff-permissions-db.py
node --test tests/*.test.mjs
pnpm --filter @yellowshifts/mobile test
```

These PostgreSQL harnesses create disposable local clusters. They never connect to production. Migration tests check conflict rollback, Sunday reassignment, preserved overnight timestamps/assignment IDs/per-day availability/notes, no notification fanout, and Sunday-only constraints. Existing atomic availability/RLS tests exercise the new RPC.
