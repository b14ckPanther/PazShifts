import type { MobileHome } from '@yellowshifts/database/public';
export function selectStation(allowed: readonly { id: string }[], selected: string | null) {
  return allowed.find((s) => s.id === selected)?.id ?? allowed[0]?.id ?? null;
}
export function heroState(data: MobileHome, now: number) {
  if (data.active)
    return {
      kind: 'active' as const,
      shift: data.shifts.find((s) => s.id === data.active?.scheduled_shift_id),
    };
  const shift = data.shifts.find((s) => Date.parse(s.end_at) > now);
  if (shift) {
    const start = Date.parse(shift.start_at);
    if (start - now <= 3600000) return { kind: 'soon' as const, shift };
    if (shift.shift_date === data.today) return { kind: 'today' as const, shift };
  }
  if (data.completedToday) return { kind: 'completed' as const, shift };
  if (shift) return { kind: 'upcoming' as const, shift };
  return { kind: 'empty' as const, shift: undefined };
}
export const onboardingKey = 'ys.onboarding.v1';
export function onboardingDone(value: string | null) {
  return value === 'complete';
}
export const tabs = [
  { name: 'index', label: 'בית' },
  { name: 'schedule', label: 'משמרות' },
  { name: 'availability', label: 'זמינות' },
  { name: 'hours', label: 'שעות' },
  { name: 'profile', label: 'פרופיל' },
] as const;
