import type { AttendanceRecord } from '@yellowshifts/types';
import { addDays, buildEntries, localDate, type ReportEntry } from './hours-report';

export type HourRules = {
  dailyMinutes: number[];
  firstOvertimeMinutes: number;
  firstRate: number;
  secondRate: number;
  weeklyMinutes: number | null;
  weekStartsOn: number;
  breakMinutes: number;
  breakAfterMinutes: number;
  nightStart: number;
  nightEnd: number;
  nightRate: number;
  restDays: number[];
  restRate: number;
  holidays: string[];
  holidayRate: number;
};
export type HourPolicy = { id: string; effectiveFrom: string; createdAt: string; rules: HourRules };
export function policyOn(policies: HourPolicy[], date: string): HourPolicy | undefined {
  return policies
    .filter((p) => p.effectiveFrom <= date)
    .sort(
      (a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || Number(b.id) - Number(a.id)
    )[0];
}
export function rateWeekStart(date: string, startDay: number): string {
  return addDays(date, -((new Date(date + 'T12:00:00Z').getUTCDay() - startDay + 7) % 7));
}
/** Classifies actual elapsed time; percentages never increase recorded attendance duration. */
export function classifiedEntries(
  records: AttendanceRecord[],
  from: string,
  to: string,
  timezone: string,
  policies: HourPolicy[],
  now = Date.now()
): ReportEntry[] {
  // Include the complete first payroll week, even when exporting a single mid-week day.
  const entries = buildEntries(records, addDays(from, -7), to, timezone, now);
  const byRecord = new Map(records.map((r) => [r.id, r]));
  const days = new Map<string, { paid: number; overtime: number }>();
  const weeks = new Map<string, number>();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const minuteCache = new Map<number, number>();
  for (const entry of entries) {
    entry.rateSeconds = {};
    entry.breakSeconds = 0;
    const policy = policyOn(policies, entry.date);
    if (!entry.seconds) continue;
    if (!policy) {
      entry.rateSeconds.unclassified = entry.seconds;
      continue;
    }
    entry.policyId = policy.id;
    entry.rateWeek = rateWeekStart(entry.date, policy.rules.weekStartsOn);
    const rules = policy.rules;
    const original = byRecord.get(entry.id)!;
    const originalEnd = Date.parse(original.clock_out_at!);
    const shiftPolicy = policyOn(policies, localDate(new Date(original.clock_in_at), timezone));
    const shiftRules = shiftPolicy?.rules;
    const deduction =
      shiftRules &&
      originalEnd - Date.parse(original.clock_in_at) >= shiftRules.breakAfterMinutes * 60000
        ? shiftRules.breakMinutes * 60000
        : 0;
    const breakStart = originalEnd - deduction;
    const start = Date.parse(entry.start),
      end = Date.parse(entry.end!);
    entry.breakSeconds = Math.max(0, end - Math.max(start, breakStart)) / 1000;
    const paidEnd = Math.min(end, breakStart);
    const dayKey = `${entry.personId}:${entry.date}`;
    const weekKey = `${entry.personId}:${policy.id}:${entry.rateWeek}`;
    const day = days.get(dayKey) || { paid: 0, overtime: 0 };
    let regularWeek = weeks.get(weekKey) || 0;
    const weekday = new Date(entry.date + 'T12:00:00Z').getUTCDay();
    const regularLimit = rules.dailyMinutes[weekday]! * 60000;
    const weeklyLimit = rules.weeklyMinutes === null ? Infinity : rules.weeklyMinutes * 60000;
    const specialRate = Math.max(
      rules.restDays.includes(weekday) ? rules.restRate : 100,
      rules.holidays.includes(entry.date) ? rules.holidayRate : 100
    );
    let cursor = start;
    while (cursor < paidEnd) {
      const minute = Math.floor(cursor / 60000);
      let localMinute = minuteCache.get(minute);
      if (localMinute === undefined) {
        const parts = formatter.formatToParts(new Date(cursor));
        localMinute =
          Number(parts.find((p) => p.type === 'hour')!.value) * 60 +
          Number(parts.find((p) => p.type === 'minute')!.value);
        minuteCache.set(minute, localMinute);
      }
      const isNight =
        rules.nightStart === rules.nightEnd
          ? false
          : rules.nightStart < rules.nightEnd
            ? localMinute >= rules.nightStart && localMinute < rules.nightEnd
            : localMinute >= rules.nightStart || localMinute < rules.nightEnd;
      const overtime = day.paid >= regularLimit || regularWeek >= weeklyLimit;
      const baseRate = overtime
        ? day.overtime < rules.firstOvertimeMinutes * 60000
          ? rules.firstRate
          : rules.secondRate
        : 100;
      const rate = Math.max(baseRate, specialRate, isNight ? rules.nightRate : 100);
      let elapsed = Math.min(paidEnd, (minute + 1) * 60000) - cursor;
      if (!overtime)
        elapsed = Math.min(elapsed, regularLimit - day.paid, weeklyLimit - regularWeek);
      else if (day.overtime < rules.firstOvertimeMinutes * 60000)
        elapsed = Math.min(elapsed, rules.firstOvertimeMinutes * 60000 - day.overtime);
      entry.rateSeconds[String(rate)] = (entry.rateSeconds[String(rate)] || 0) + elapsed / 1000;
      day.paid += elapsed;
      if (overtime) day.overtime += elapsed;
      else regularWeek += elapsed;
      cursor += elapsed;
    }
    days.set(dayKey, day);
    weeks.set(weekKey, regularWeek);
  }
  return entries.filter((e) => e.date >= from && e.date <= to);
}
