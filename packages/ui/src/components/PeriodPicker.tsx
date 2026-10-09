'use client';

import { useState } from 'react';
import { addDays, displayDate, weekStart } from '@yellowshifts/reports';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@yellowshifts/icons';
import '../styles/period-picker.css';

const monthName = new Intl.DateTimeFormat('he-IL', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthStart = (date: string) => date.slice(0, 8) + '01';
const monthEnd = (date: string) => addDays(monthStart(addDays(monthStart(date), 32)), -1);
const shiftMonth = (date: string, months: number) => {
  const [y, m] = date.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + months, 1));
  return d.toISOString().slice(0, 10);
};
const days = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;

/** Whole calendar months step by month; anything else steps by its own length. */
function step(from: string, to: string, direction: 1 | -1): [string, string] {
  if (from === monthStart(from) && to === monthEnd(from)) {
    const start = shiftMonth(from, direction);
    return [start, monthEnd(start)];
  }
  const length = days(from, to);
  return [addDays(from, direction * length), addDays(to, direction * length)];
}

export function periodLabel(from: string, to: string): string {
  if (from === monthStart(from) && to === monthEnd(from))
    return monthName.format(new Date(from + 'T12:00:00Z'));
  const [fy, fm, fd] = from.split('-');
  const [ty, tm, td] = to.split('-');
  if (from === to) return displayDate(from);
  if (fy !== ty) return `${displayDate(from)} – ${displayDate(to)}`;
  return `${fd}/${fm} – ${td}/${tm}/${ty}`;
}

export function PeriodPicker({
  from,
  to,
  today,
  pending = false,
  maxDays = 93,
  onChange,
}: {
  from: string;
  to: string;
  today: string;
  pending?: boolean;
  maxDays?: number;
  onChange: (from: string, to: string) => void;
}) {
  const week = weekStart(today, 0);
  const presets: { label: string; range: [string, string] }[] = [
    { label: 'השבוע', range: [week, addDays(week, 6)] },
    { label: 'שבוע קודם', range: [addDays(week, -7), addDays(week, -1)] },
    { label: 'החודש', range: [monthStart(today), monthEnd(today)] },
    { label: 'חודש קודם', range: [shiftMonth(today, -1), monthEnd(shiftMonth(today, -1))] },
  ];
  const active = presets.findIndex(({ range }) => range[0] === from && range[1] === to);
  const [custom, setCustom] = useState(active < 0);
  const [error, setError] = useState('');
  const previous = step(from, to, -1);
  const next = step(from, to, 1);

  return (
    <div className="period-picker" aria-busy={pending || undefined}>
      <div className="period-stepper">
        <button
          type="button"
          className="period-step"
          disabled={pending}
          aria-label={`תקופה קודמת: ${periodLabel(...previous)}`}
          onClick={() => onChange(...previous)}
        >
          <ChevronRightIcon size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="period-current"
          aria-expanded={custom}
          aria-controls="period-custom"
          aria-label={`${periodLabel(from, to)} – בחירת תאריכים`}
          disabled={pending}
          onClick={() => setCustom((open) => !open)}
        >
          <strong aria-live="polite">{periodLabel(from, to)}</strong>
          <small>
            <CalendarIcon size={13} aria-hidden="true" />
            {active < 0 ? `${days(from, to)} ימים` : 'בחירת תאריכים'}
          </small>
        </button>
        <button
          type="button"
          className="period-step"
          disabled={pending || next[0] > today}
          aria-label={`תקופה הבאה: ${periodLabel(...next)}`}
          onClick={() => onChange(...next)}
        >
          <ChevronLeftIcon size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="period-presets" role="group" aria-label="בחירה מהירה של תקופה">
        {presets.map(({ label, range }, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={index === active}
            disabled={pending}
            onClick={() => {
              setCustom(false);
              onChange(...range);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {custom && (
        <form
          id="period-custom"
          key={`${from}-${to}`}
          className="period-custom"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const start = String(data.get('from'));
            const end = String(data.get('to'));
            if (end < start) return setError('תאריך הסיום מוקדם מתאריך ההתחלה.');
            if (days(start, end) > maxDays) return setError(`אפשר לבחור עד ${maxDays} ימים.`);
            setError('');
            onChange(start, end);
          }}
        >
          <label>
            <span>מתאריך</span>
            <input type="date" name="from" required defaultValue={from} />
          </label>
          <label>
            <span>עד תאריך</span>
            <input type="date" name="to" required defaultValue={to} />
          </label>
          <button
            type="submit"
            className="ys-button ys-button--primary"
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? 'טוענים…' : 'הצגה'}
          </button>
          {error && (
            <p role="alert" className="period-error">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
