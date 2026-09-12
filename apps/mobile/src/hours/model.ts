import { addDays, duration, rateTotals, weekStart, type ReportEntry } from '@yellowshifts/reports';
import type { HoursPeriod } from '@yellowshifts/database/public';
export const hoursText = (seconds: number) => duration(seconds).slice(0, -3);
export function summarize(entries: ReportEntry[]) {
  return {
    seconds: entries.reduce((n, e) => n + e.seconds, 0),
    breaks: entries.reduce((n, e) => n + (e.breakSeconds || 0), 0),
    shifts: new Set(entries.filter((e) => e.seconds > 0).map((e) => e.id)).size,
    excluded: entries.filter((e) => e.status !== 'הושלמה'),
    rates: rateTotals(entries),
  };
}
export function groupDays(entries: ReportEntry[], startsOn: number) {
  const grouped = new Map<string, ReportEntry[]>();
  for (const e of entries) grouped.set(e.date, [...(grouped.get(e.date) || []), e]);
  return [...grouped]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, rows]) => ({
      date,
      week: weekStart(date, startsOn),
      entries: rows,
      ...summarize(rows),
    }));
}
export function movePeriod(period: HoursPeriod, from: string, delta: number): HoursPeriod {
  if (period.mode === 'custom') return period;
  if (period.mode === 'week') return { mode: 'week', anchor: addDays(from, delta * 7) };
  const date = new Date(from + 'T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + delta);
  return { mode: 'month', anchor: date.toISOString().slice(0, 10) };
}
export const dayTitle = (day: string) =>
  new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(day + 'T12:00:00Z'));
