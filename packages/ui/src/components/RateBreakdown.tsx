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
  ]
    .sort((a, b) => Number(a) - Number(b))
    // Only buckets that actually hold time are shown (the base rate stays when all are empty).
    .filter(
      (key, _index, all) =>
        (totals[key] || 0) > 0 || (key === '100' && all.every((k) => !(totals[k] || 0)))
    );
  const breaks = entries.reduce((s, e) => s + (e.breakSeconds || 0), 0);
  // A table row with no time (open or overlapping shift) needs no breakdown at all.
  if (compact && !keys.some((key) => (totals[key] || 0) > 0) && !totals.unclassified && !breaks)
    return null;
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
