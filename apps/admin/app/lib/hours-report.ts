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
};
export type HoursReport = {
  station: string;
  timezone: string;
  from: string;
  to: string;
  generatedAt: string;
  people: ReportPerson[];
  entries: ReportEntry[];
};
export function localDate(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  return ['year', 'month', 'day']
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join('-');
}
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(day + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
export function weekStart(day: string): string {
  return addDays(day, -((new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7));
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
  const s = Math.floor(seconds);
  return `${Math.floor(s / 3600)
    .toString()
    .padStart(2, '0')}:${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
export function clock(value: string | null, timezone: string): string {
  return value
    ? new Intl.DateTimeFormat('he-IL', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(value))
    : '—';
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
      for (let date = from; date <= to; date = addDays(date, 1)) {
        const a = Math.max(start, boundaries.get(date)!);
        const b = Math.min(end!, boundaries.get(addDays(date, 1))!, periodEnd);
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
  const rows: (string | number)[][] = [
    [
      'תחנה',
      'שם',
      'קוד עובד',
      'מזהה שיוך',
      'תאריך',
      'תחילת שבוע',
      'כניסה (בחלק המדווח)',
      'יציאה (בחלק המדווח)',
      'משך HH:mm:ss',
      'שעות עשרוניות',
      'סטטוס',
      'מקור',
      'סיבת תיקון',
      'מועד תיקון',
      'מזהה נוכחות',
      'אזור זמן',
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
      ]);
    for (const e of entries)
      rows.push([
        report.station,
        person.name,
        person.code,
        person.id,
        e.date,
        weekStart(e.date),
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
      ]);
  }
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
export function summaryCsv(report: HoursReport): string {
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
        weekStart(date),
        date,
        duration(seconds),
        (seconds / 3600).toFixed(4),
        entries.filter((e) => e.status !== 'הושלמה').length,
        report.timezone,
      ]);
    }
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function weeklyCsv(report: HoursReport): string {
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
    ],
  ];
  for (const person of report.people)
    for (let week = weekStart(report.from); week <= report.to; week = addDays(week, 7)) {
      const entries = report.entries.filter(
        (e) => e.personId === person.id && weekStart(e.date) === week
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
      ]);
    }
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
