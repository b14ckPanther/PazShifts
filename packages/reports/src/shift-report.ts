import type { AttendanceRecord } from '@yellowshifts/types';
import { buildEntries, localDate, type ReportEntry } from './hours-report';
import { classifiedEntries, type HourPolicy } from './rates';

/** Calendar ownership is the station-local check-in date. Classification still uses actual days. */
export function shiftReportEntries(
  records: AttendanceRecord[],
  from: string,
  to: string,
  timezone: string,
  policies?: HourPolicy[],
  now = Date.now()
): ReportEntry[] {
  const selected = records.filter((r) => {
    const date = localDate(new Date(r.clock_in_at), timezone);
    return date >= from && date <= to;
  });
  let through = to;
  for (const r of selected) {
    const end = r.clock_out_at ? Date.parse(r.clock_out_at) : NaN;
    if (r.status === 'COMPLETED' && end > Date.parse(r.clock_in_at) && end <= now) {
      const last = localDate(new Date(end - 1), timezone);
      if (last > through) through = last;
    }
  }
  const segments = policies
    ? classifiedEntries(records, from, through, timezone, policies, now)
    : buildEntries(records, from, through, timezone, now);
  const grouped = new Map<string, ReportEntry[]>();
  for (const entry of segments) grouped.set(entry.id, [...(grouped.get(entry.id) ?? []), entry]);
  return selected
    .flatMap((r) => {
      const rows = grouped.get(r.id);
      if (!rows?.length) return [];
      const rateSeconds: Record<string, number> = {};
      for (const row of rows)
        for (const [rate, seconds] of Object.entries(row.rateSeconds ?? {}))
          rateSeconds[rate] = (rateSeconds[rate] ?? 0) + seconds;
      return [
        {
          ...rows[0]!,
          date: localDate(new Date(r.clock_in_at), timezone),
          start: r.clock_in_at,
          end: r.clock_out_at,
          seconds: rows.reduce((sum, e) => sum + e.seconds, 0),
          ...(policies
            ? {
                rateSeconds,
                breakSeconds: rows.reduce((sum, e) => sum + (e.breakSeconds ?? 0), 0),
                policyId:
                  [...new Set(rows.map((e) => e.policyId).filter(Boolean))].join(';') || undefined,
                rateWeek:
                  [...new Set(rows.map((e) => e.rateWeek).filter(Boolean))].join(';') || undefined,
              }
            : {}),
        },
      ];
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}
