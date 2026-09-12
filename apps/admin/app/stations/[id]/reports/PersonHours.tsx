'use client';

import { useState } from 'react';
import { HoursTable, RateBreakdown } from '@yellowshifts/ui';
import { duration, type HoursReport, type ReportPerson } from '@yellowshifts/reports';

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
  return (
    <details
      className="report-panel"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>{person.name}</strong>
          <small>{person.code || 'ללא קוד עובד'}</small>
        </span>
        <span dir="ltr">{duration(entries.reduce((sum, e) => sum + e.seconds, 0))}</span>
      </summary>
      {open && (
        <>
          {!entries.length && <p>לא נרשמו שעות בתקופה שנבחרה.</p>}
          <RateBreakdown entries={entries} />
          <HoursTable report={report} />
        </>
      )}
    </details>
  );
}
