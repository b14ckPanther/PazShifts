import {
  addDays,
  clock,
  duration,
  localDate,
  weekStart,
  type HoursReport,
} from '@yellowshifts/reports';
import '../styles/hours-table.css';
import { RateBreakdown } from './RateBreakdown';

export function HoursTable({ report }: { report: HoursReport }) {
  const days: string[] = [];
  for (let date = report.from; date <= report.to; date = addDays(date, 1)) days.push(date);
  return (
    <div
      className="hours-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="טבלת שעות — ניתן לגלול לרוחב"
    >
      <table className="hours-table" role="table">
        <caption>שעות נוכחות · {report.timezone}</caption>
        <thead>
          <tr>
            <th scope="col">יום</th>
            <th scope="col">כניסה</th>
            <th scope="col">יציאה</th>
            <th scope="col">משך</th>
            <th scope="col">מצב</th>
          </tr>
        </thead>
        <tbody>
          {days.map((date, index) => {
            const entries = report.entries.filter((e) => e.date === date);
            const week = weekStart(date, 0);
            const last = index === days.length - 1 || weekStart(days[index + 1]!, 0) !== week;
            return (
              <HoursDay
                key={date}
                date={date}
                report={report}
                entries={entries}
                weekTotal={
                  last
                    ? report.entries
                        .filter((e) => weekStart(e.date, 0) === week)
                        .reduce((s, e) => s + e.seconds, 0)
                    : null
                }
              />
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              סה״כ בתקופה
            </th>
            <td dir="ltr">{duration(report.entries.reduce((s, e) => s + e.seconds, 0))}</td>
            <td>שעות סגורות</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
function HoursDay({
  date,
  entries,
  report,
  weekTotal,
}: {
  date: string;
  entries: HoursReport['entries'];
  report: HoursReport;
  weekTotal: number | null;
}) {
  return (
    <>
      {entries.length ? (
        entries.map((e, index) => (
          <tr key={`${e.id}-${index}`}>
            <th scope="row">
              <bdi>{date}</bdi>
            </th>
            <td dir="ltr">{clock(e.start, report.timezone)}</td>
            <td dir="ltr">
              {clock(e.end, report.timezone)}
              {e.end && localDate(new Date(e.end), report.timezone) !== e.date && (
                <small dir="rtl">
                  יציאה ב־<bdi>{localDate(new Date(e.end), report.timezone)}</bdi>
                </small>
              )}
            </td>
            <td dir="ltr">{duration(e.seconds)}</td>
            <td>
              <span className={e.status === 'הושלמה' ? '' : 'hours-table-warning'}>{e.status}</span>
              <small>{e.source}</small>
              <RateBreakdown entries={[e]} compact />
              {e.reason && <small>תיקון: {e.reason}</small>}
            </td>
          </tr>
        ))
      ) : (
        <tr>
          <th scope="row">
            <bdi>{date}</bdi>
          </th>
          <td>—</td>
          <td>—</td>
          <td dir="ltr">00:00:00</td>
          <td>ללא נוכחות</td>
        </tr>
      )}
      {entries.length > 1 && (
        <tr className="hours-table-subtotal">
          <th scope="row" colSpan={3}>
            סה״כ יומי
          </th>
          <td dir="ltr">{duration(entries.reduce((s, e) => s + e.seconds, 0))}</td>
          <td />
        </tr>
      )}
      {weekTotal !== null && (
        <tr className="hours-table-week">
          <th scope="row" colSpan={3}>
            סיכום שבוע <bdi>{weekStart(date, 0)}</bdi>
          </th>
          <td dir="ltr">{duration(weekTotal)}</td>
          <td />
        </tr>
      )}
    </>
  );
}
