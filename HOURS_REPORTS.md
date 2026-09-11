# Station hours reports

Station admins and platform admins can open **שעות / דוח שעות עבודה** from a station. Shift managers and workers cannot access these reports. The page verifies the current user's station role before querying attendance, and queries use the authenticated Supabase client and existing RLS.

Choose a week or a date range of up to 93 days. Select one worker or the whole station team. Historical/inactive memberships and admins are included so past attendance remains reportable. Expand a worker to see weekly totals, daily totals and attendance segments. Refresh before exporting if attendance was recently corrected.

Exports follow the selected worker and period:

- PDF: team summary, individual totals, daily and weekly detail, statuses and correction reasons. Hebrew RTL with embedded, locally hosted Heebo font (license in `apps/admin/public/fonts/Heebo-OFL.txt`); generation runs on the client and loads only on demand.
- Daily CSV: one row per worker per date, including zero-hour dates.
- Weekly CSV: one row per worker per week, with totals limited to the selected date range.
- Detail CSV: attendance segments, stable identifiers, original record ID, source and correction information. CSV files have a UTF-8 BOM for Hebrew in Excel and escape formula-like text.

Totals count only closed COMPLETED records with valid timestamps. Open, FLAGGED, future-ended and overlapping attendance is listed for review with zero counted hours. Overlap detection covers records in the selected station; database write constraints enforce cross-station overlap prevention. These are recorded attendance hours, not payroll calculations: no automatic deduction for breaks, overtime classification or wage calculation.

Overnight records are divided at midnight in the station timezone, and clipped to the selected period. Durations use elapsed time, including daylight-saving changes; exports show HH:mm:ss and CSV also includes decimal hours. Sum raw durations before rounding. Detail CSV timestamps are ISO UTC; the UI and PDF clock displays use the station timezone.

Attendance and membership queries paginate beyond Supabase's default 1,000-row limit, with a 50,000-row safety limit. Query failures produce an error rather than an incomplete export. Reports reflect the loaded data; they are not immutable accounting snapshots. No schema changes, database migration or `supabase db push` is required for this feature. Publish the code and redeploy the admin app.

Verification: `node --test tests/*.test.mjs`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm build`. Export QA uses synthetic Hebrew/English names, mobile browser viewports and rendered PDF pages; it does not claim physical iPhone verification.
