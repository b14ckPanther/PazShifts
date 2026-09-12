import { duration, rateTotals, type ReportEntry } from '@yellowshifts/reports';
export function RateBreakdown({
  entries,
  compact = false,
}: {
  entries: ReportEntry[];
  compact?: boolean;
}) {
  const totals = rateTotals(entries);
  const keys = [
    ...new Set(['100', '125', '150', ...Object.keys(totals).filter((k) => k !== 'unclassified')]),
  ].sort((a, b) => Number(a) - Number(b));
  const breaks = entries.reduce((s, e) => s + (e.breakSeconds || 0), 0);
  return (
    <div
      className={compact ? 'hour-rates compact' : 'hour-rates'}
      aria-label="סיווג שעות לפי תעריף"
    >
      {keys.map((key) => (
        <span key={key}>
          <strong>{key}%</strong>
          <bdi>{duration(totals[key] || 0)}</bdi>
        </span>
      ))}
      {(totals.unclassified || 0) > 0 && (
        <span className="hour-rates-unconfigured">
          <strong>ללא כללים</strong>
          <bdi>{duration(totals.unclassified!)}</bdi>
        </span>
      )}
      {breaks > 0 && (
        <span>
          <strong>ניכוי הפסקות</strong>
          <bdi>{duration(breaks)}</bdi>
        </span>
      )}
    </div>
  );
}
