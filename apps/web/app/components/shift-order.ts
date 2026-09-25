import { scheduledWallTimeToInstant } from '@yellowshifts/database/src/schedule-instant';

/** Scheduled wall times are not UTC instants; classify only after station conversion. */
export function orderWorkerShifts<T extends { id: string; startAt: string; endAt: string }>(
  shifts: readonly T[],
  timezone: string,
  now: number
) {
  return shifts
    .map((shift) => {
      const start = Date.parse(scheduledWallTimeToInstant(shift.startAt, timezone));
      const end = Date.parse(scheduledWallTimeToInstant(shift.endAt, timezone));
      return { shift, start, past: end <= now };
    })
    .sort(
      (a, b) =>
        Number(a.past) - Number(b.past) ||
        (a.past ? b.start - a.start : a.start - b.start) ||
        a.shift.id.localeCompare(b.shift.id)
    );
}
