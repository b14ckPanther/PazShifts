# Mobile Phase 4 — Hours

## Delivered

Hours is a native read-only experience: weekly/monthly navigation, current/previous week shortcuts, native custom-date selection, completed attendance hero, rate cards, break deductions, a reverse-chronological daily timeline and weekly grouping for longer periods. Empty and active-only periods are distinct. Open/flagged/overlapping records remain visible without contributing to confirmed totals. Corrections and authorized reasons appear in a dismissible day sheet.

The sheet distinguishes the engine's daily segment from original check-in/out timestamps. Midnight is never presented as an actual checkout when a shift continues overnight. Detail lists mount only when opened and reveal 20 entries at a time. All period totals remain complete. No PDF/CSV export, wage calculation, schema change or attendance mutation was added.

## One reporting engine

`packages/database/src/mobile-hours.ts` uses existing `readOwnReportAttendance`, `getHourPolicies`, `classifiedEntries`, `dayBoundary`, `weekStart` and `localDate`. The query retains the web path's seven-day lookback for weekly thresholds. Rate classification, break deduction, policy versions/effective dates, overlaps, exclusions and DST remain in `packages/reports`, untouched.

The mobile model only groups/sums already-classified entries and formats durations. The hero reports completed attendance **before** deductions; rate cards report classified time **after** deductions. Unclassified historical time retains the engine's explicit unclassified category. Rule/query failure never manufactures a zero-hour report. Durations are presented in hours/minutes; original seconds remain in the shared entries.

## Security, freshness and scope

- `getMobileWorkerHours(client, stationId, period)` has no user selector. It derives identity through `getNativeWorkerContext`, validates active station membership, then uses the user's client and existing RLS. Active attendance is separately read for that user/station even when viewing history.
- `getNativeWorkerContext` now accepts an optional expected identity: existing callers still enforce their supplied identity; Hours can derive it directly without a second Auth request. No authorization check was removed.
- `HoursPeriod` supports week/month with optional calendar anchor, or custom from/to. Weekly boundaries use the same policy setting as worker web. Custom ranges reject invalid dates, reverse order, future end dates and more than 93 inclusive days. Current week/month may include remaining calendar days, matching existing reporting semantics.
- The latest read-only period lives only in the mounted screen. Same-period refresh preserves scroll/content and labels stale data after downstream network/query failure. Failed identity/membership verification clears it. Account/station changes remount private state. Obsolete focus/period responses are ignored; another period never displays the prior period's totals.
- Focus and pull-to-refresh fetch authoritative data. No private disk cache, new global cache, authorization cache or offline mutation queue.

## Changed files and dependencies

- `app/(app)/hours.tsx`: native Hours route, replacing the old preview.
- `src/hours/Hours.tsx`, `model.ts`: UI, period state, lazy sheets and presentation grouping.
- `src/ui/index.tsx`: optional native refresh control on Screen, unchanged defaults for other screens.
- `packages/database/src/mobile-hours.ts`, `public.ts`: explicit mobile-safe Hours entry.
- `packages/database/src/worker-context.ts`: optional expected-user parameter described above.
- `tests/context.test.ts`, `tests/hours.test.mjs`, `hours-ui.test.mjs`, `hours-benchmark.mjs`, `tests/visual/HoursPreview.tsx`: isolated verification.

No dependencies, app environment variables, web/admin UX, Home calculations, Schedule, Availability or Profile changed. Home already linked to `/hours`, which now opens the full native screen. Existing DateTimePicker 9.1.0 is reused ([Expo documentation](https://docs.expo.dev/versions/latest/sdk/date-time-picker/)). No native-client rebuild is required if Phase 3's client already contains that module.

## Verification

Passed: 53 mobile tests (40 previous plus 12 Hours tests and one context test), 65 existing regression tests including the reporting/hour suites, workspace typecheck/lint/format, web/admin production builds, Expo Doctor 21/21, and both iOS/Android Hermes exports. Release source maps exclude visual fixtures, Next.js, Supabase SSR, server auth modules and PDF/jsPDF.

New tests cover policy week boundaries, leap months, custom limit/order/future validation, chronological movement, exact shared classification and break totals, corrections, overnight/DST/multiple segments, active/flagged exclusion, own-station scope, missing access, rule failure, original session timestamps versus day splits, historical active attendance, pending refresh, stale reads, access failure clearing, period changes and account/station state keys. Existing Home routing tests remain intact. No new SQL path/schema was introduced; local SQL migration tests were not relevant to this read-only change.

```sh
pnpm --filter @yellowshifts/mobile test
node --test tests/*.test.mjs
pnpm typecheck
pnpm lint
pnpm format
pnpm build
pnpm dlx expo-doctor apps/mobile
pnpm --filter @yellowshifts/mobile exec expo export --platform ios --platform android --source-maps
node apps/mobile/tests/hours-benchmark.mjs
```

### CPU measurements

Local macOS / Node 26.7.0, isolated synthetic records, one 12-hour record/day plus seven-day lookback, standard overtime/break rules; five warmups, 100 measured repetitions, concurrency 1. These measure engine/grouping CPU only, **not Hermes rendering, cold startup, hosted database or user task completion**.

| Period  | Records including lookback | Existing engine p50/p95 (ms) | Mobile grouping p50/p95 (ms) |
| ------- | -------------------------: | ---------------------------: | ---------------------------: |
| 7 days  |                         14 |                  0.73 / 0.91 |                  0.02 / 0.04 |
| 31 days |                         38 |                  1.81 / 1.98 |                  0.09 / 0.11 |
| 93 days |                        100 |                  4.77 / 5.11 |                  0.28 / 0.42 |

The UI renders at most 93 day rows, with details deferred and paged. No additional chart or virtualization dependency was justified. No before/after production latency claim is made: the previous Hours tab was a preview, not an equivalent native report.

### Simulator review

iOS 26.5 on iPhone 17 Pro and Pro Max: real authenticated read-only Hours/active attendance loaded successfully, with no data mutations. Isolated previews exercised 320/390/430-point content widths, larger text, mixed/sparse/busy periods, regular and premium rates, breaks, corrections, active-only, empty, stale error, native date popup, 93-day custom range and overnight detail. Review found and fixed clipped large-text period labels, native text autosizing that hid a zero total in the real tab shell, and misleading midnight-checkout wording.

Fixtures use the real classification engine with synthetic data and an injected reader. The temporary `hours-preview` route was removed before release export; no fixture data ships in runtime routes. The system text setting was restored after QA.

Remaining verification: physical-device haptics/scrolling/poor-network behavior, full VoiceOver/TalkBack walkthrough, Android emulator/native runtime and representative hosted latency. The width checks constrain content on Pro Max, not three separate physical phones. No measured five-second comprehension claim is made.

## Rollback and next phase

No migration, environment change or cache flush is required. Revert this phase's commit to restore the Hours preview; existing data and calculations are unchanged. No push or deployment was performed.

Recommend Phase 5: a separately approved notifications/inbox scope with consent and delivery requirements agreed first. Nothing from Phase 5, native NFC, device registration or background location was started.
