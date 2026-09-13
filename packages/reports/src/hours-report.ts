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
export function csvCell(value: string | number): string {
  let text = String(value);
  // eslint-disable-next-line no-control-regex -- Prevent formulas hidden behind leading ASCII controls.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function reportCsv(report: HoursReport): string {
  const keys = rateKeys(report);
  const rows: (string | number)[][] = [
    [
      'תחנה',
      'שם',
      'קוד עובד',
      'מזהה שיוך',
      'תאריך',
      'תחילת שבוע',
      'כניסה למשמרת',
      'יציאה מהמשמרת',
      'משך HH:mm:ss',
      'שעות עשרוניות',
      'סטטוס',
      'מקור',
      'סיבת תיקון',
      'מועד תיקון',
      'מזהה נוכחות',
      'אזור זמן',
      ...rateHeaders(keys),
    ],
  ];
  for (const person of report.people) {
    const entries = report.entries.filter((e) => e.personId === person.id);
    if (!entries.length)
      rows.push([
        report.station,
        person.name,
        person.code,
        person.id,
        '',
        '',
        '',
        '',
        duration(0),
        '0.00',
        'ללא נוכחות',
        '',
        '',
        '',
        '',
        report.timezone,
        ...rateValues([], keys),
      ]);
    for (const e of entries)
      rows.push([
        report.station,
        person.name,
        person.code,
        person.id,
        e.date,
        weekStart(e.date, 0),
        e.start,
        e.end || '',
        duration(e.seconds),
        (e.seconds / 3600).toFixed(4),
        e.status,
        e.source,
        e.reason,
        e.correctedAt || '',
        e.id,
        report.timezone,
        ...rateValues([e], keys),
      ]);
  }
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
export function summaryCsv(report: HoursReport): string {
  const keys = rateKeys(report);
  const rows: (string | number)[][] = [
    [
      'תחנה',
      'שם',
      'קוד עובד',
      'מזהה שיוך',
      'תחילת שבוע',
      'תאריך',
      'שעות HH:mm:ss',
      'שעות עשרוניות',
      'רשומות לבדיקה',
      'אזור זמן',
      ...rateHeaders(keys),
    ],
  ];
  for (const person of report.people)
    for (let date = report.from; date <= report.to; date = addDays(date, 1)) {
      const entries = report.entries.filter((e) => e.personId === person.id && e.date === date);
      const seconds = entries.reduce((sum, e) => sum + e.seconds, 0);
      rows.push([
        report.station,
        person.name,
        person.code,
        person.id,
        weekStart(date, 0),
        date,
        duration(seconds),
        (seconds / 3600).toFixed(4),
        entries.filter((e) => e.status !== 'הושלמה').length,
        report.timezone,
        ...rateValues(entries, keys),
      ]);
    }
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function weeklyCsv(report: HoursReport): string {
  const keys = rateKeys(report);
  const rows: (string | number)[][] = [
    [
      'תחנה',
      'שם',
      'קוד עובד',
      'מזהה שיוך',
      'תחילת שבוע',
      'שעות HH:mm:ss',
      'שעות עשרוניות',
      'רשומות לבדיקה',
      'מתאריך',
      'עד תאריך',
      ...rateHeaders(keys),
    ],
  ];
  for (const person of report.people)
    for (let week = weekStart(report.from, 0); week <= report.to; week = addDays(week, 7)) {
      const entries = report.entries.filter(
        (e) => e.personId === person.id && weekStart(e.date, 0) === week
      );
      const seconds = entries.reduce((sum, e) => sum + e.seconds, 0);
      rows.push([
        report.station,
        person.name,
        person.code,
        person.id,
        week,
        duration(seconds),
        (seconds / 3600).toFixed(4),
        new Set(entries.filter((e) => e.status !== 'הושלמה').map((e) => e.id)).size,
        report.from,
        report.to,
        ...rateValues(entries, keys),
      ]);
    }
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
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
export function rateKeys(report: HoursReport): string[] {
  return [
    ...new Set([
      '100',
      '125',
      '150',
      ...Object.keys(rateTotals(report.entries)).filter((k) => k !== 'unclassified'),
    ]),
  ].sort((a, b) => Number(a) - Number(b));
}
export function rateText(entries: ReportEntry[]): string {
  const totals = rateTotals(entries);
  const parts = Object.entries(totals)
    .filter(([, seconds]) => seconds > 0)
    .map(
      ([rate, seconds]) =>
        `${rate === 'unclassified' ? 'ללא כללים' : rate + '%'}: ${duration(seconds)}`
    );
  const breaks = entries.reduce((s, e) => s + (e.breakSeconds || 0), 0);
  if (breaks) parts.push(`ניכוי הפסקות: ${duration(breaks)}`);
  return parts.join(' · ') || 'ללא שעות לסיווג';
}
function rateHeaders(keys: string[]): string[] {
  return [
    ...keys.map((k) => `${k}% HH:mm:ss`),
    'ללא כללים HH:mm:ss',
    'ניכוי הפסקות HH:mm:ss',
    'גרסאות כללים',
  ];
}
function rateValues(entries: ReportEntry[], keys: string[]): string[] {
  const totals = rateTotals(entries);
  return [
    ...keys.map((k) => duration(totals[k] || 0)),
    duration(totals.unclassified || 0),
    duration(entries.reduce((s, e) => s + (e.breakSeconds || 0), 0)),
    [...new Set(entries.map((e) => e.policyId).filter(Boolean))].join(';'),
  ];
}
