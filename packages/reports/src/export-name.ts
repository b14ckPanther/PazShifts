import type { HoursReport } from './hours-report';

const labels = {
  pdf: 'דוח שעות',
  daily: 'סיכום יומי',
  weekly: 'סיכום שבועי',
  detail: 'פירוט נוכחות',
} as const;

// Preserve Hebrew; remove filesystem-unsafe and invisible direction characters.
function safePart(value: string, fallback: string): string {
  const clean = Array.from(value.normalize('NFC'), (character) => {
    const code = character.codePointAt(0)!;
    return code < 32 || (code >= 127 && code <= 159) ? ' ' : character;
  })
    .join('')
    .replace(/[<>:"/\\|?*\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '');
  let result = '';
  const encoder = new TextEncoder();
  for (const character of clean) {
    if (encoder.encode(result + character).length > 64) break;
    result += character;
  }
  return result.trim().replace(/[. ]+$/g, '') || fallback;
}

/** Extensionless: PDF writer adds .pdf; CSV callers add .csv. Scope is explicit. */
export function hoursExportName(
  report: Pick<HoursReport, 'station' | 'from' | 'to'>,
  kind: keyof typeof labels,
  workerName?: string
): string {
  const date = (value: string) => value.split('-').reverse().join('-');
  return [
    labels[kind],
    safePart(report.station, 'תחנה'),
    workerName === undefined ? 'כל הצוות' : safePart(workerName, 'עובד'),
    date(report.from) + '_' + date(report.to),
  ].join(' - ');
}
