'use client';

import { useState } from 'react';
import { HoursTable } from '@yellowshifts/ui';
import { DownloadIcon } from '@yellowshifts/icons';
import {
  hoursMinutes,
  hoursSummary,
  payRateTotals,
  type HoursReport,
  type ReportPerson,
} from '@yellowshifts/reports';

export function PersonHours({
  report,
  person,
  initiallyOpen,
  rates = [],
  rateTotals,
  busy = false,
  onPdf,
}: {
  report: HoursReport;
  person: ReportPerson;
  initiallyOpen: boolean;
  /** Percent columns shared by every row: 100/125/150 plus any other rule percentage. */
  rates?: string[];
  /** Precomputed by the parent for large teams; derived from the entries otherwise. */
  rateTotals?: Record<string, number>;
  busy?: boolean;
  onPdf?: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const entries = report.entries;
  const summary = hoursSummary(entries);
  const totals = rateTotals ?? payRateTotals(entries);
  const idle = !entries.length;
  return (
    <details
      className="report-worker"
      data-idle={idle || undefined}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="report-worker-name">
          <strong>{person.name}</strong>
          {person.code && <small>{person.code}</small>}
        </span>
        <span className="report-cell">
          <bdi>{summary.days}</bdi>
          <span className="report-cell-label"> ימים</span>
        </span>
        <span className="report-cell">
          <bdi>{summary.shifts}</bdi>
          <span className="report-cell-label"> משמרות</span>
        </span>
        {rates.map((rate) => (
          <span
            key={rate}
            className="report-cell report-cell--rate"
            data-empty={(totals[rate] || 0) > 0 ? undefined : 'true'}
          >
            <span className="report-cell-label">{rate}% </span>
            <bdi>{hoursMinutes(totals[rate] || 0)}</bdi>
          </span>
        ))}
        <span className="report-worker-total">
          <bdi>{hoursMinutes(summary.seconds)}</bdi>
        </span>
      </summary>
      {open && (
        <div className="report-worker-details">
          <HoursTable report={report} />
          {onPdf && !idle && (
            <button
              type="button"
              className="ys-button ys-button--secondary ys-button--sm report-worker-pdf"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={onPdf}
            >
              <DownloadIcon size={16} aria-hidden="true" />
              {busy ? 'מכינים PDF…' : `PDF של ${person.name}`}
            </button>
          )}
        </div>
      )}
    </details>
  );
}
