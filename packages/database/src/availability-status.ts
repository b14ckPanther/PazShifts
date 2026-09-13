import type { WeeklyAvailabilityWithEntries } from '@yellowshifts/types';
/** A migrated partial week is preserved, but must not appear fully submitted. */
export function isAvailabilitySubmitted(saved: WeeklyAvailabilityWithEntries | null): boolean {
  if (!saved?.week.submittedAt || saved.entries.length !== 7) return false;
  const start = Date.parse(saved.week.weekStartDate + 'T00:00:00Z');
  const dates = new Set(saved.entries.map((entry) => entry.date));
  return Array.from({ length: 7 }, (_, i) =>
    new Date(start + i * 86400000).toISOString().slice(0, 10)
  ).every((date) => dates.has(date));
}
