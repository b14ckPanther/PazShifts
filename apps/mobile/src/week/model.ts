import { addDays, weekStart, localDate } from '@yellowshifts/reports';
import type {
  SaveAvailabilityEntryInput,
  WeeklyAvailabilityWithEntries,
} from '@yellowshifts/types';
export const days = (week: string) => Array.from({ length: 7 }, (_, i) => addDays(week, i));
export const stationWeek = (timezone: string, now = new Date()) =>
  weekStart(localDate(now, timezone), 0);
export function validDay(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'numeric' }
) =>
  new Intl.DateTimeFormat('he-IL', { ...options, timeZone: 'UTC' }).format(
    new Date(date + 'T12:00:00Z')
  );
export function draftFor(
  week: string,
  saved: WeeklyAvailabilityWithEntries | null
): SaveAvailabilityEntryInput[] {
  return days(week).map((date) => {
    const e = saved?.entries.find((e) => e.date === date);
    return {
      date,
      availabilityType: e?.availabilityType ?? 'ALL_DAY_AVAILABLE',
      startTime: e?.startTime?.slice(0, 5) ?? null,
      endTime: e?.endTime?.slice(0, 5) ?? null,
      notes: e?.notes ?? null,
    };
  });
}
export const fingerprint = (entries: SaveAvailabilityEntryInput[]) => JSON.stringify(entries);
export const validDraft = (entries: SaveAvailabilityEntryInput[]) =>
  entries.length === 7 &&
  entries.every(
    (e) =>
      e.availabilityType !== 'TIME_WINDOW' ||
      Boolean(
        e.startTime &&
        e.endTime &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(e.startTime) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(e.endTime) &&
        e.startTime !== e.endTime
      )
  );
export function shiftDay(week: string, selected: string, delta: number) {
  const next = addDays(week, delta * 7);
  return { week: next, day: addDays(selected, delta * 7) };
}
