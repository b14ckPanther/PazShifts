# Station hours reports

Station admins and platform admins can open **שעות / דוח שעות עבודה** from a station. Shift managers and workers cannot access these reports. The page verifies the current user's station role before querying attendance, and queries use the authenticated Supabase client and existing RLS.

Choose a week or a date range of up to 93 days. Select one worker or the whole station team. Historical/inactive memberships and admins are included so past attendance remains reportable. Expand a worker to see weekly totals, daily totals and attendance segments. Refresh before exporting if attendance was recently corrected.

Exports follow the selected worker and period:

- PDF: team summary, individual totals, daily and weekly detail, statuses and correction reasons. Hebrew RTL with embedded, locally hosted Heebo font (license in `apps/admin/public/fonts/Heebo-OFL.txt`); generation runs on the client and loads only on demand.
- Daily CSV: one row per worker per date, including zero-hour dates.
- Weekly CSV: one row per worker per week, with totals limited to the selected date range.
- Detail CSV: attendance segments, stable identifiers, original record ID, source and correction information. CSV files have a UTF-8 BOM for Hebrew in Excel and escape formula-like text.

Totals count only closed COMPLETED records with valid timestamps. Open, FLAGGED, future-ended and overlapping attendance is listed for review with zero counted hours. Overlap detection covers records in the selected station; database write constraints enforce cross-station overlap prevention. Recorded attendance remains unchanged. Saved station rules classify hours by percentage and optionally deduct a fixed break for reporting; monetary wage calculation is not included.

Overnight records are divided at midnight in the station timezone, and clipped to the selected period. Durations use elapsed time, including daylight-saving changes; exports show HH:mm:ss and CSV also includes decimal hours. Sum raw durations before rounding. Detail CSV timestamps are ISO UTC; the UI and PDF clock displays use the station timezone.

Attendance and membership queries paginate beyond Supabase's default 1,000-row limit, with a 50,000-row safety limit. Query failures produce an error rather than an incomplete export. Reports reflect the loaded data; they are not immutable accounting snapshots. Apply `20260912000015_station_hour_rules.sql` with `supabase db push` before deploying these changes, then redeploy both apps.

Verification: `node --test tests/*.test.mjs`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm build`. Export QA uses synthetic Hebrew/English names, mobile browser viewports and rendered PDF pages; it does not claim physical iPhone verification.

## Worker self-service

Workers can open **השעות שלי** in the worker app. The page selects only the signed-in user's attendance in one of their active station memberships; URL parameters cannot select another user. Historical dates can be inspected in ranges of up to 93 days. Inactive station access is unchanged.

Both apps now use `@yellowshifts/reports` for durations and exports, and the shared `HoursTable` for daily rows and weekly/period totals. The phone layout keeps the date, entrance, exit and duration together, with status/correction details beneath; wide screens use a conventional table. PDF exports now use aligned table columns and embedded Hebrew fonts. PDF generation remains loaded only on demand.

## Admin-configured hour rules

Open **Station → Hours → הגדרת כללי שעות ותוספות**. Only active station ADMIN members and platform admins can save rules; authorization is enforced in both the server action and a database RPC. Workers read applicable rules for their own station to calculate their own reports.

The initial form is an unsaved example, not an automatic legal/payroll policy. Configure daily limits in minutes for each weekday, the first overtime band and both percentages, an optional weekly regular-hours limit, and the payroll week start. Optional settings cover a fixed per-shift break deduction, a night-time rate window, selected rest weekdays and explicit holiday dates. Percentages may range from 100 through 300.

Calculation semantics:

- Multiple shifts accumulate within a local calendar date. Overnight shifts split at midnight in the station timezone; actual elapsed time is used across DST.
- Daily overtime is excluded from the weekly regular-hours budget. Daily and weekly overflow share the first overtime band for that day; the remainder gets the second rate.
- Night/rest/holiday premiums are minimum applicable rates. The highest applicable rate wins; percentages do not stack. A night window with matching start/end is disabled. Holidays/rest days cover whole local dates; there is no automatic holiday calendar or rest-period span calculation.
- Optional fixed breaks apply once per completed shift that reaches the configured duration. They are allocated at the end of that shift for rate classification. Clock timestamps and raw attendance totals remain unchanged.
- Rates are station-scoped, not a combined calculation across employers/stations. No base hourly wage, statutory eligibility, overtime authorization or final salary is inferred.
- Open/flagged/overlapping records remain excluded. Valid hours before the first policy are explicitly unclassified, never silently treated as 100%.
- The first payroll week is fetched in full even for a partial-week export. UI, PDFs and all CSV variants use the same classified entries. Exports include percentages, break deductions and policy version references in CSV.

Rules are append-only versions. Effective dates must fall on the selected week-start day. Initial historical classification requires explicit acknowledgement. Subsequent changes must be future-dated and cannot precede the latest scheduled version; the payroll week start cannot change after initial setup. Saving again for the same future date appends a replacement version, preserving the previous entry. Past versions are not edited. Attendance corrections can still change reports because reports are live calculations, not closed payroll snapshots.

Deployment: run `supabase db push --dry-run`, inspect the pending migration list, then `supabase db push`. Push and redeploy both apps. Save the station's first rule version and refresh reports. No database changes were applied remotely by Codex.
