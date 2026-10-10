import type { AttendanceRecord } from '@yellowshifts/types';

export type ReportPerson = { id: string; name: string; code: string };
export type ReportEntry = {
  id: string;
  personId: string;
  date: string;
  start: string;
  end: string | null;
  seconds: number;
  status: string;
  reason: string;
  correctedAt: string | null;
  source: string;
  rateSeconds?: Record<string, number>;
  breakSeconds?: number;
  policyId?: string;
  rateWeek?: string;
};
export type HoursReport = {
  station: string;
  timezone: string;
  from: string;
  to: string;
  generatedAt: string;
  people: ReportPerson[];
  entries: ReportEntry[];
  policies?: { id: string; effectiveFrom: string }[];
  rateWeekStartsOn?: number;
};
// Cache formatting machinery only: no employee data, calculated results, or authorization.
// Bounded to avoid unbounded timezone keys in a long-lived process/browser.
const formatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(timezone: string, kind: 'date' | 'clock'): Intl.DateTimeFormat {
  const key = `${kind}:${timezone}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(kind === 'date' ? 'en-CA' : 'he-IL', {
      timeZone: timezone,
      ...(kind === 'date'
        ? { year: 'numeric', month: '2-digit', day: '2-digit' }
        : { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
    });
    if (formatters.size >= 32) formatters.delete(formatters.keys().next().value!);
    formatters.set(key, formatter);
  }
  return formatter;
}
export function localDate(value: Date, timezone: string): string {
  const parts = dateFormatter(timezone, 'date').formatToParts(value);
  return ['year', 'month', 'day']
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join('-');
}
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(day + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
export function weekStart(day: string, startDay = 1): string {
  return addDays(day, -((new Date(day + 'T12:00:00Z').getUTCDay() - startDay + 7) % 7));
}
export function validDate(day: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
/** First instant of a calendar date in the station timezone (including DST changes). */
export function dayBoundary(day: string, timezone: string): number {
  let low = Date.parse(day + 'T00:00:00Z') - 36 * 3600000;
  let high = low + 72 * 3600000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(new Date(middle), timezone) < day) low = middle;
    else high = middle;
  }
  return high;
}
export function duration(seconds: number): string {
  const s = Math.floor(Math.round(seconds * 1000) / 1000);
  return `${Math.floor(s / 3600)
    .toString()
    .padStart(2, '0')}:${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
export function clock(value: string | null, timezone: string): string {
  return value ? dateFormatter(timezone, 'clock').format(new Date(value)) : '—';
}
/** Readable totals: 61:27 (hours may exceed 24). Rounded to the nearest minute. */
export function hoursMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, '0')}`;
}
/** Payroll-style decimal hours: 7.50. */
export function decimalHours(seconds: number): string {
  return (Math.round(seconds / 36) / 100).toFixed(2);
}
/** Clock without seconds, in the station timezone: 07:05. */
export function shortClock(value: string | null, timezone: string): string {
  return value ? clock(value, timezone).slice(0, 5) : '—';
}
/** 2026-09-01 -> 01/09/2026 */
export function displayDate(date: string): string {
  return date.split('-').reverse().join('/');
}
export const HEBREW_WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export function weekdayLabel(date: string): string {
  return HEBREW_WEEKDAYS[new Date(date + 'T12:00:00Z').getUTCDay()]!;
}
/** Only closed shifts count; open, flagged and overlapping records show with zero hours. */
export function isCounted(entry: Pick<ReportEntry, 'status'>): boolean {
  return entry.status === 'הושלמה';
}
export function isManual(entry: Pick<ReportEntry, 'source'>): boolean {
  return entry.source !== 'NFC';
}
/** Totals for one worker (or the whole selection): hours, distinct work days and shifts. */
export function hoursSummary(entries: ReportEntry[]) {
  const counted = entries.filter((e) => isCounted(e) && e.seconds > 0);
  return {
    seconds: entries.reduce((sum, e) => sum + e.seconds, 0),
    days: new Set(counted.map((e) => `${e.personId}:${e.date}`)).size,
    shifts: counted.length,
    attention: new Set(entries.filter((e) => !isCounted(e)).map((e) => e.id)).size,
  };
}
/** Percent buckets with classified time; empty when no hour rules apply to the selection. */
export function classifiedRates(entries: ReportEntry[]): [string, number][] {
  return Object.entries(rateTotals(entries))
    .filter(([rate, seconds]) => rate !== 'unclassified' && seconds > 0)
    .sort(([a], [b]) => Number(a) - Number(b));
}
/** Rate columns always shown in exports, plus any other percentage the station rules use. */
export const STANDARD_RATES = ['100', '125', '150'] as const;
const DEFAULT_REGULAR = 8 * 3600;
const DEFAULT_FIRST_OVERTIME = 2 * 3600;
/**
 * Seconds per percentage for each shift. Station rules win where they classified the time;
 * otherwise a work day (per worker, by check-in date) is 8h at 100%, the next 2h at 125%
 * and the rest at 150%. Multiple shifts on one day share the same 8 hours.
 */
export function payRates(entries: ReportEntry[]): Map<ReportEntry, Record<string, number>> {
  const result = new Map<ReportEntry, Record<string, number>>();
  const days = new Map<string, number>();
  // ISO timestamps sort correctly as plain strings (and much faster than localeCompare).
  for (const entry of [...entries].sort((a, b) =>
    a.start < b.start ? -1 : a.start > b.start ? 1 : 0
  )) {
    const rates: Record<string, number> = {};
    const given = entry.rateSeconds || { unclassified: entry.seconds };
    for (const [rate, seconds] of Object.entries(given))
      if (rate !== 'unclassified' && seconds > 0) rates[rate] = seconds;
    let left = given.unclassified || 0;
    if (left > 0) {
      const key = `${entry.personId}:${entry.date}`;
      let worked = days.get(key) || 0;
      for (const [rate, limit] of [
        ['100', DEFAULT_REGULAR],
        ['125', DEFAULT_REGULAR + DEFAULT_FIRST_OVERTIME],
        ['150', Infinity],
      ] as const) {
        const part = Math.min(left, Math.max(0, limit - worked));
        if (part > 0) {
          rates[rate] = (rates[rate] || 0) + part;
          worked += part;
          left -= part;
        }
      }
      days.set(key, worked);
    }
    result.set(entry, rates);
  }
  return result;
}
export function payRateTotals(entries: ReportEntry[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const rates of payRates(entries).values())
    for (const [rate, seconds] of Object.entries(rates))
      totals[rate] = (totals[rate] || 0) + seconds;
  return totals;
}
/** 100/125/150 always, then any extra percentage that holds time (e.g. 175, 200). */
export function payRateKeys(
  entries: ReportEntry[],
  totals: Record<string, number> = payRateTotals(entries)
): string[] {
  return [
    ...new Set([...STANDARD_RATES, ...Object.keys(totals).filter((k) => totals[k]! > 0)]),
  ].sort((a, b) => Number(a) - Number(b));
}
export function buildEntries(
  records: AttendanceRecord[],
  from: string,
  to: string,
  timezone: string,
  now = Date.now()
): ReportEntry[] {
  const boundaries = new Map<string, number>();
  for (let date = from; date <= addDays(to, 1); date = addDays(date, 1))
    boundaries.set(date, dayBoundary(date, timezone));
  const periodStart = boundaries.get(from)!;
  const periodEnd = boundaries.get(addDays(to, 1))!;
  const dates = [...boundaries.keys()];
  const instants = [...boundaries.values()];
  function firstDay(start: number): number {
    let low = 0;
    let high = dates.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (instants[middle + 1]! <= start) low = middle + 1;
      else high = middle;
    }
    return low;
  }
  const overlaps = new Set<string>();
  const sorted = [...records].sort((a, b) => Date.parse(a.clock_in_at) - Date.parse(b.clock_in_at));
  const previous = new Map<string, AttendanceRecord[]>();
  for (const record of sorted) {
    const start = Date.parse(record.clock_in_at);
    const active = (previous.get(record.user_id) || []).filter(
      (r) => !r.clock_out_at || Date.parse(r.clock_out_at) > start
    );
    for (const other of active) {
      overlaps.add(other.id);
      overlaps.add(record.id);
    }
    active.push(record);
    previous.set(record.user_id, active);
  }
  return records
    .flatMap((record) => {
      const start = Date.parse(record.clock_in_at);
      const end = record.clock_out_at ? Date.parse(record.clock_out_at) : null;
      const valid =
        record.status === 'COMPLETED' &&
        end !== null &&
        end > start &&
        end <= now &&
        !overlaps.has(record.id);
      const status = overlaps.has(record.id)
        ? 'חפיפה — לבדיקה'
        : record.status === 'ACTIVE'
          ? 'משמרת פתוחה'
          : record.status === 'FLAGGED'
            ? 'ממתינה לאישור מנהל'
            : !valid
              ? 'לבדיקה — לא נספר'
              : 'הושלמה';
      const common = {
        id: record.id,
        personId: record.station_membership_id,
        status,
        reason: record.correction_reason || '',
        correctedAt: record.corrected_at,
        source:
          record.clock_in_source === 'MANUAL_ADMIN' || record.clock_out_source === 'MANUAL_ADMIN'
            ? 'תיקון / דיווח ידני'
            : 'NFC',
      };
      if (!valid)
        return [
          {
            ...common,
            date: localDate(new Date(Math.max(start, periodStart)), timezone),
            start: record.clock_in_at,
            end: record.clock_out_at,
            seconds: 0,
          },
        ];
      const rows: ReportEntry[] = [];
      for (let i = firstDay(start); i < dates.length - 1 && instants[i]! < end!; i++) {
        const date = dates[i]!;
        const a = Math.max(start, instants[i]!);
        const b = Math.min(end!, instants[i + 1]!, periodEnd);
        if (b > a)
          rows.push({
            ...common,
            date,
            start: new Date(a).toISOString(),
            end: new Date(b).toISOString(),
            seconds: (b - a) / 1000,
          });
      }
      return rows;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}
/** Hundredths of an hour as printed in exports: 7.50 h -> 750. */
export function hundredths(seconds: number): number {
  return Math.round(seconds / 36);
}
export function printedHours(value: number): string {
  return (value / 100).toFixed(2);
}
/**
 * Per-shift rate cells in hundredths, rounded so they add up to the printed hours (unless a
 * break deduction makes them intentionally smaller); the rounding remainder goes to the top rate.
 */
export function printedRates(entries: ReportEntry[]): Map<ReportEntry, Record<string, number>> {
  const result = new Map<ReportEntry, Record<string, number>>();
  for (const [entry, rates] of payRates(entries)) {
    const row: Record<string, number> = {};
    const keys = Object.keys(rates).sort((a, b) => Number(a) - Number(b));
    for (const key of keys) row[key] = hundredths(rates[key]!);
    const top = keys.filter((key) => row[key]! > 0).pop();
    if (top && !entry.breakSeconds)
      row[top]! += hundredths(entry.seconds) - keys.reduce((sum, key) => sum + row[key]!, 0);
    result.set(entry, row);
  }
  return result;
}
export function csvCell(value: string | number): string {
  let text = String(value);
  // eslint-disable-next-line no-control-regex -- Prevent formulas hidden behind leading ASCII controls.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
/** 01/09, or 01/09/26 when the period spans years. */
export function shortDate(date: string, period: Pick<HoursReport, 'from' | 'to'>): string {
  const [y, m, d] = date.split('-');
  return period.from.slice(0, 4) !== period.to.slice(0, 4)
    ? `${d}/${m}/${y!.slice(2)}`
    : `${d}/${m}`;
}
function groupBy(entries: ReportEntry[], key: (entry: ReportEntry) => string) {
  const groups = new Map<string, ReportEntry[]>();
  for (const entry of entries) {
    const group = groups.get(key(entry));
    if (group) group.push(entry);
    else groups.set(key(entry), [entry]);
  }
  return groups;
}
type CsvRow = { cells: (string | number)[]; entries: ReportEntry[]; hours?: string; note?: string };
/** Same numbers as the PDF: totals are sums of the printed per-shift values. */
function hoursCsv(
  report: HoursReport,
  columns: string[],
  rows: (entries: ReportEntry[]) => CsvRow[],
  total: (entries: ReportEntry[]) => (string | number)[],
  notes = false
): string {
  const keys = payRateKeys(report.entries);
  const rates = printedRates(report.entries);
  const multi = report.people.length > 1;
  const hours = (entries: ReportEntry[]) =>
    printedHours(entries.reduce((sum, e) => sum + hundredths(e.seconds), 0));
  const rate = (entries: ReportEntry[], key: string) => {
    const value = entries.reduce((sum, e) => sum + (rates.get(e)?.[key] || 0), 0);
    return value > 0 ? printedHours(value) : '';
  };
  const out: (string | number)[][] = [
    [
      ...(multi ? ['עובד'] : []),
      ...columns,
      'שעות',
      ...keys.map((key) => `${key}%`),
      ...(notes ? ['הערה'] : []),
    ],
  ];
  for (const person of report.people) {
    const entries = report.entries.filter((e) => e.personId === person.id);
    if (multi && !entries.length) continue;
    const name = multi ? [person.name] : [];
    for (const row of [...rows(entries), { cells: total(entries), entries }] as CsvRow[])
      out.push([
        ...name,
        ...row.cells,
        row.hours ?? hours(row.entries),
        ...keys.map((key) => rate(row.entries, key)),
        ...(notes ? [row.note ?? ''] : []),
      ]);
  }
  return '\ufeff' + out.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
export function entryNote(entry: Pick<ReportEntry, 'status'>): string {
  if (isCounted(entry)) return '';
  if (entry.status === 'משמרת פתוחה') return 'משמרת פתוחה · לא נספרה';
  if (entry.status.startsWith('חפיפה')) return 'חפיפה · לא נספרה';
  if (entry.status === 'ממתינה לאישור מנהל') return 'ממתינה לאישור · לא נספרה';
  return 'לבדיקה · לא נספרה';
}
export function reportCsv(report: HoursReport): string {
  return hoursCsv(
    report,
    ['תאריך', 'יום', 'כניסה', 'יציאה'],
    (entries) =>
      entries.map((e) => ({
        cells: [
          displayDate(e.date),
          weekdayLabel(e.date),
          shortClock(e.start, report.timezone),
          shortClock(e.end, report.timezone),
        ],
        entries: [e],
        hours: isCounted(e) ? printedHours(hundredths(e.seconds)) : '—',
        note: entryNote(e),
      })),
    () => ['סה״כ', '', '', ''],
    true
  );
}
export function summaryCsv(report: HoursReport): string {
  return hoursCsv(
    report,
    ['תאריך', 'יום'],
    (entries) =>
      [...groupBy(entries, (e) => e.date)].map(([date, own]) => ({
        cells: [displayDate(date), weekdayLabel(date)],
        entries: own,
      })),
    () => ['סה״כ', '']
  );
}
export function weeklyCsv(report: HoursReport): string {
  const counts = (entries: ReportEntry[]) => {
    const summary = hoursSummary(entries);
    return [summary.days, summary.shifts];
  };
  return hoursCsv(
    report,
    ['שבוע', 'ימי עבודה', 'משמרות'],
    (entries) =>
      [...groupBy(entries, (e) => weekStart(e.date, 0))].map(([week, own]) => ({
        cells: [
          `${shortDate(week, report)}–${shortDate(addDays(week, 6), report)}`,
          ...counts(own),
        ],
        entries: own,
      })),
    (entries) => ['סה״כ', ...counts(entries)]
  );
}

export function rateTotals(entries: ReportEntry[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const entry of entries)
    for (const [rate, seconds] of Object.entries(
      entry.rateSeconds || { unclassified: entry.seconds }
    ))
      totals[rate] = (Math.round((totals[rate] || 0) * 1000) + Math.round(seconds * 1000)) / 1000;
  return totals;
}
