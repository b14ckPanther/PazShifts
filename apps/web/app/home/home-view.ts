import type { MobileHome } from '@yellowshifts/database/public';
export function elapsedClock(start: string, now: number) {
  const parsed = Date.parse(start);
  const seconds = Number.isFinite(parsed) ? Math.max(0, Math.floor((now - parsed) / 1000)) : 0;
  return {
    seconds,
    label: [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':'),
  };
}
export function nextHomeShift(data: MobileHome, now: number) {
  return (
    data.shifts
      .filter((s) => Date.parse(s.start_at) > now && s.id !== data.active?.scheduled_shift_id)
      .sort(
        (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at) || a.id.localeCompare(b.id)
      )[0] ?? null
  );
}
