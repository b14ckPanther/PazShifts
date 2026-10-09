import { hoursMinutes, payRateKeys, payRateTotals, type ReportEntry } from '@yellowshifts/reports';

/** Hours per percentage: 100/125/150 always, by station rules or the default 8h/2h split. */
export function RateBreakdown({
  entries,
  compact = false,
}: {
  entries: ReportEntry[];
  compact?: boolean;
}) {
  if (!entries.some((e) => e.seconds > 0)) return null;
  const totals = payRateTotals(entries);
  const breaks = entries.reduce((s, e) => s + (e.breakSeconds || 0), 0);
  return (
    <div
      className={compact ? 'hour-rates compact' : 'hour-rates'}
      aria-label="סיווג שעות לפי תעריף"
    >
      {payRateKeys(entries, totals).map((rate) => (
        <span key={rate}>
          <strong>{rate}%</strong>
          <bdi>{hoursMinutes(totals[rate] || 0)}</bdi>
        </span>
      ))}
      {breaks > 0 && (
        <span>
          <strong>ניכוי הפסקות</strong>
          <bdi>{hoursMinutes(breaks)}</bdi>
        </span>
      )}
    </div>
  );
}
