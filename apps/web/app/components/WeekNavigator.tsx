'use client';

import type { ReactNode } from 'react';
import { ChevronEndGlyph, ChevronStartGlyph } from '@yellowshifts/icons';

export function WeekNavigator({
  start,
  end,
  onNavigate,
  previousDisabled = false,
  nextDisabled = false,
  label = 'השבוע הנבחר',
  days,
  children,
}: {
  start: string;
  end: string;
  onNavigate: (days: number) => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  label?: string;
  /** Optional day strip under the range. */
  days?: ReactNode;
  children?: ReactNode;
}) {
  // Compact range ("27/09 – 03/10") with the year(s) underneath, so it never wraps mid-range.
  const dayMonth = (date: string) => date.slice(5, 10).split('-').reverse().join('/');
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const years = startYear === endYear ? startYear : `${startYear}–${endYear}`;
  return (
    <section className="worker-week" aria-label="בחירת שבוע" dir="rtl">
      <nav className="worker-week-nav" aria-label="ניווט בין שבועות">
        <div className="worker-week-date" aria-live="polite">
          <span>{label}</span>
          <strong dir="ltr">
            <time dateTime={start}>{dayMonth(start)}</time>
            <span aria-hidden="true">–</span>
            <time dateTime={end}>{dayMonth(end)}</time>
          </strong>
          <small className="ys-num">{years}</small>
        </div>
        <button
          type="button"
          className="worker-week-previous"
          onClick={() => onNavigate(-7)}
          disabled={previousDisabled}
        >
          <ChevronStartGlyph size={20} strokeWidth={2} />
          <span>שבוע קודם</span>
        </button>
        <button
          type="button"
          className="worker-week-next"
          onClick={() => onNavigate(7)}
          disabled={nextDisabled}
        >
          <span>שבוע הבא</span>
          <ChevronEndGlyph size={20} strokeWidth={2} />
        </button>
      </nav>
      {days}
      {children && <div className="worker-week-status">{children}</div>}
    </section>
  );
}
