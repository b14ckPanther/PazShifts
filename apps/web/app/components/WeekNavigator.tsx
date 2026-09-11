'use client';

import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@yellowshifts/icons';

export function WeekNavigator({
  start,
  end,
  onNavigate,
  previousDisabled = false,
  nextDisabled = false,
  label = 'השבוע הנבחר',
  children,
}: {
  start: string;
  end: string;
  onNavigate: (days: number) => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  label?: string;
  children?: ReactNode;
}) {
  const format = (date: string) => date.slice(0, 10).split('-').reverse().join('/');
  return (
    <section className="worker-week" aria-label="בחירת שבוע" dir="rtl">
      <nav className="worker-week-nav" aria-label="ניווט בין שבועות">
        <div className="worker-week-date" aria-live="polite">
          <span>{label}</span>
          <strong dir="ltr">
            <time dateTime={start}>{format(start)}</time>
            <span aria-hidden="true"> – </span>
            <time dateTime={end}>{format(end)}</time>
          </strong>
        </div>
        <button
          type="button"
          className="worker-week-previous"
          onClick={() => onNavigate(-7)}
          disabled={previousDisabled}
        >
          <ChevronRightIcon size={18} aria-hidden="true" />
          <span>שבוע קודם</span>
        </button>
        <button
          type="button"
          className="worker-week-next"
          onClick={() => onNavigate(7)}
          disabled={nextDisabled}
        >
          <span>שבוע הבא</span>
          <ChevronLeftIcon size={18} aria-hidden="true" />
        </button>
      </nav>
      {children && <div className="worker-week-status">{children}</div>}
    </section>
  );
}
