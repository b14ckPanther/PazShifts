'use client';

import { useState } from 'react';
import { HoursTable, RateBreakdown } from '@yellowshifts/ui';
import { duration, rateTotals, type HoursReport, type ReportPerson } from '@yellowshifts/reports';

/** Column order of the worker summary; the header row in HoursReportClient mirrors it. */
export const WORKER_COLUMNS = ['100%', '125%', '150%', 'אחר', 'הפסקות'] as const;

export function PersonHours({
  report,
  person,
  initiallyOpen,
}: {
  report: HoursReport;
  person: ReportPerson;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const entries = report.entries;
  const totals = rateTotals(entries);
  const other = Object.entries(totals)
    .filter(([key]) => key !== '100' && key !== '125' && key !== '150')
    .reduce((sum, [, seconds]) => sum + seconds, 0);
  const breaks = entries.reduce((sum, e) => sum + (e.breakSeconds || 0), 0);
  const cells = [totals['100'] || 0, totals['125'] || 0, totals['150'] || 0, other, breaks];
  return (
    <details
      className="report-worker"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="report-worker-name">
          <strong>{person.name}</strong>
          <small>{person.code || 'ללא קוד עובד'}</small>
        </span>
        {cells.map((seconds, i) => (
          <span
            key={WORKER_COLUMNS[i]}
            className="report-cell"
            data-empty={seconds > 0 ? undefined : 'true'}
          >
            <span className="report-cell-label">{WORKER_COLUMNS[i]} </span>
            <bdi className="ys-num">{duration(seconds)}</bdi>
          </span>
        ))}
        <span className="report-worker-total ys-num" dir="ltr">
          {duration(entries.reduce((sum, e) => sum + e.seconds, 0))}
        </span>
      </summary>
      {open && (
        <div className="report-worker-details">
          {!entries.length && <p className="report-worker-empty">לא נרשמו שעות בתקופה שנבחרה.</p>}
          <RateBreakdown entries={entries} />
          <HoursTable report={report} />
        </div>
      )}
    </details>
  );
}
