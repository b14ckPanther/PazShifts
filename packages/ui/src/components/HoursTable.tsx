'use client';

import { Fragment, useState } from 'react';
import {
  addDays,
  hoursMinutes,
  isCounted,
  payRates,
  shortClock,
  weekdayLabel,
  weekStart,
  type HoursReport,
  type ReportEntry,
} from '@yellowshifts/reports';
import '../styles/hours-table.css';

const shortDate = (date: string) => date.slice(8, 10) + '/' + date.slice(5, 7);

/** Premium buckets only (above the base rate) – the part worth noticing per shift. */
function premiums(rates: Record<string, number> | undefined): [string, number][] {
  return Object.entries(rates ?? {})
    .filter(([rate, seconds]) => Number(rate) > 100 && seconds > 0)
    .sort(([a], [b]) => Number(a) - Number(b));
}

export function HoursTable({ report }: { report: HoursReport }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const byDate = new Map<string, ReportEntry[]>();
  for (const entry of report.entries)
    byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  const allDays: string[] = [];
  for (let date = report.from; date <= report.to; date = addDays(date, 1)) allDays.push(date);
  const days = showEmpty ? allDays : allDays.filter((date) => byDate.has(date));
  const emptyDays = allDays.length - allDays.filter((date) => byDate.has(date)).length;
  const multiWeek = weekStart(report.from, 0) !== weekStart(report.to, 0);
  const total = report.entries.reduce((sum, e) => sum + e.seconds, 0);
  const rates = payRates(report.entries);

  const weeks = new Map<string, string[]>();
  for (const date of days) {
    const week = weekStart(date, 0);
    weeks.set(week, [...(weeks.get(week) ?? []), date]);
  }

  if (!report.entries.length && !showEmpty)
    return (
      <div className="hours-empty">
        <p>לא נרשמו משמרות בתקופה זו.</p>
      </div>
    );

  return (
    <div className="hours-table-wrap">
      <table className="hours-table">
        <thead>
          <tr>
            <th scope="col">יום</th>
            <th scope="col">כניסה</th>
            <th scope="col">יציאה</th>
            <th scope="col">שעות</th>
          </tr>
        </thead>
        <tbody>
          {[...weeks].map(([week, dates]) => (
            <Fragment key={week}>
              {multiWeek && (
                <tr className="hours-week">
                  <th scope="rowgroup" colSpan={3}>
                    שבוע{' '}
                    <bdi>
                      {shortDate(week < report.from ? report.from : week)}–
                      {shortDate(addDays(week, 6) > report.to ? report.to : addDays(week, 6))}
                    </bdi>
                  </th>
                  <td>
                    <bdi>
                      {hoursMinutes(
                        report.entries
                          .filter((e) => weekStart(e.date, 0) === week)
                          .reduce((sum, e) => sum + e.seconds, 0)
                      )}
                    </bdi>
                  </td>
                </tr>
              )}
              {dates.map((date) => (
                <Day
                  key={date}
                  date={date}
                  entries={byDate.get(date) ?? []}
                  report={report}
                  rates={rates}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              סה״כ
            </th>
            <td>
              <bdi>{hoursMinutes(total)}</bdi>
            </td>
          </tr>
        </tfoot>
      </table>
      {emptyDays > 0 && (
        <button
          type="button"
          className="hours-empty-toggle"
          aria-pressed={showEmpty}
          onClick={() => setShowEmpty((value) => !value)}
        >
          {showEmpty ? 'הסתרת ימים ללא משמרות' : `הצגת ימים ללא משמרות (${emptyDays})`}
        </button>
      )}
    </div>
  );
}

function Day({
  date,
  entries,
  report,
  rates,
}: {
  date: string;
  entries: ReportEntry[];
  report: HoursReport;
  rates: Map<ReportEntry, Record<string, number>>;
}) {
  const label = (
    <th scope="row" className="hours-day">
      <span>{weekdayLabel(date)}</span>
      <bdi>{shortDate(date)}</bdi>
    </th>
  );
  if (!entries.length)
    return (
      <tr className="hours-row is-empty">
        {label}
        <td className="hours-none">ללא משמרת</td>
      </tr>
    );
  return (
    <>
      {entries.map((entry, index) => {
        const counted = isCounted(entry);
        const extra = premiums(rates.get(entry));
        const notes = !counted || extra.length > 0;
        return (
          <tr
            key={`${entry.id}-${index}`}
            className={`hours-row${counted ? '' : ' is-attention'}${index ? ' is-continued' : ''}${notes ? ' has-notes' : ''}`}
          >
            {index === 0 && label}
            <td className="hours-in">
              <bdi>{shortClock(entry.start, report.timezone)}</bdi>
            </td>
            <td className="hours-out">
              <bdi>{shortClock(entry.end, report.timezone)}</bdi>
            </td>
            <td className="hours-duration">
              <bdi>{counted ? hoursMinutes(entry.seconds) : '—'}</bdi>
            </td>
            {notes && (
              <td className="hours-notes">
                {!counted && <span className="hours-flag">{entry.status} · לא נספרה</span>}
                {extra.map(([rate, seconds]) => (
                  <span key={rate} className="hours-tag hours-tag--rate">
                    <bdi>{rate}%</bdi> <bdi>{hoursMinutes(seconds)}</bdi>
                  </span>
                ))}
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}
