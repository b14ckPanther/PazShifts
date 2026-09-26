'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RateBreakdown } from '@yellowshifts/ui';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import {
  hoursExportName,
  addDays,
  duration,
  reportCsv,
  summaryCsv,
  weeklyCsv,
  weekStart,
  type HoursReport,
} from '@/app/lib/hours-report';
import './reports.css';
import { PersonHours, WORKER_COLUMNS } from './PersonHours';

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function HoursReportClient({
  report,
  stationId,
  today,
}: {
  report: HoursReport;
  stationId: string;
  today: string;
}) {
  const [personId, setPersonId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const filtered = useMemo(
    () => ({
      ...report,
      people: report.people.filter((p) => !personId || p.id === personId),
      entries: report.entries.filter((e) => !personId || e.personId === personId),
    }),
    [report, personId]
  );
  const total = filtered.entries.reduce((sum, e) => sum + e.seconds, 0);
  const flagged = new Set(filtered.entries.filter((e) => e.status !== 'הושלמה').map((e) => e.id))
    .size;
  const exportName = (kind: 'pdf' | 'daily' | 'weekly' | 'detail') =>
    hoursExportName(filtered, kind, personId ? filtered.people[0]?.name || 'עובד' : undefined);
  function navigate(from: string, to: string) {
    startTransition(() => router.push(`?from=${from}&to=${to}`));
  }
  async function pdf() {
    setBusy(true);
    setError('');
    try {
      const { exportHoursPdf } = await import('@/app/lib/hours-pdf');
      await exportHoursPdf(filtered, exportName('pdf'));
    } catch {
      setError('יצירת ה-PDF נכשלה. נסו שוב או הורידו CSV.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="hours-report" aria-busy={pending}>
      <div className="ys-page-header report-header">
        <div className="ys-page-header-text">
          <div className="ys-page-header-title">
            <h1>דוח שעות עבודה</h1>
          </div>
          <p>סיכום הצוות, פירוט יומי וייצוא להנהלת חשבונות</p>
        </div>
      </div>

      <nav className="station-nav-pills" aria-label="דוחות ושעות">
        <Link href={`/stations/${stationId}/reports`} aria-current="page">
          דוח שעות
        </Link>
        <Link href={`/stations/${stationId}/reports/settings`}>הגדרת כללי שעות ותוספות</Link>
      </nav>

      <section className="report-panel report-controls" aria-label="בחירת תקופה ועובד">
        <form
          key={`${report.from}-${report.to}`}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            navigate(String(data.get('from')), String(data.get('to')));
          }}
          className="admin-toolbar report-filters"
        >
          <div className="ys-form-field">
            <label className="ys-label" htmlFor="report-from">
              מתאריך
            </label>
            <input id="report-from" required type="date" name="from" defaultValue={report.from} />
          </div>
          <div className="ys-form-field">
            <label className="ys-label" htmlFor="report-to">
              עד תאריך
            </label>
            <input id="report-to" required type="date" name="to" defaultValue={report.to} />
          </div>
          <button
            type="submit"
            className="ys-button ys-button--primary"
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? 'טוענים…' : 'הצגת דוח'}
          </button>
        </form>
        <div className="admin-toolbar report-toolbar-row">
          <div className="report-week-buttons" role="group" aria-label="מעבר מהיר בין שבועות">
            <button
              type="button"
              className="ys-button ys-button--secondary"
              disabled={pending}
              onClick={() => navigate(addDays(report.from, -7), addDays(report.to, -7))}
            >
              שבוע קודם
            </button>
            <button
              type="button"
              className="ys-button ys-button--secondary"
              disabled={pending}
              onClick={() => navigate(weekStart(today, 0), addDays(weekStart(today, 0), 6))}
            >
              השבוע הנוכחי
            </button>
            <button
              type="button"
              className="ys-button ys-button--secondary"
              disabled={pending}
              onClick={() => navigate(addDays(report.from, 7), addDays(report.to, 7))}
            >
              שבוע הבא
            </button>
          </div>
          <div className="ys-form-field report-person">
            <label className="ys-label" htmlFor="report-person">
              עובד / כל הצוות
            </label>
            <select
              id="report-person"
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
            >
              <option value="">כל הצוות ({report.people.length})</option>
              {report.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.code ? ` · ${p.code}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="report-summary" aria-label="סיכום התקופה">
        <dl className="report-facts">
          <div className="report-fact is-primary">
            <dt>שעות סגורות בתקופה</dt>
            <dd>
              <bdi className="ys-num" dir="ltr">
                {duration(total)}
              </bdi>
              <small>
                (<span className="ys-num">{(total / 3600).toFixed(2)}</span> שעות עשרוניות)
              </small>
            </dd>
          </div>
          <div className="report-fact">
            <dt>עובדים בדוח</dt>
            <dd>
              <span className="ys-num">{filtered.people.length}</span>
              <small>כולל עובדים ללא שעות</small>
            </dd>
          </div>
          <div className={flagged ? 'report-fact is-attention' : 'report-fact'}>
            <dt>רשומות לבדיקה</dt>
            <dd>
              <span className="ys-num">{flagged}</span>
              <small>פתוחות / מסומנות / חופפות</small>
            </dd>
          </div>
        </dl>
        <RateBreakdown entries={filtered.entries} compact />
      </section>
      <section className="report-panel report-export">
        <div className="report-export-head">
          <h2>ייצוא {personId ? 'העובד שנבחר' : 'כל הצוות'}</h2>
          <p className="report-period">
            <bdi className="ys-num">
              {report.from} — {report.to}
            </bdi>
            <bdi>{report.timezone}</bdi>
          </p>
        </div>
        <div className="report-exports">
          <button
            type="button"
            className="ys-button ys-button--primary"
            disabled={busy || pending}
            aria-busy={busy || undefined}
            onClick={pdf}
          >
            {busy ? 'מכינים PDF…' : 'הורדת PDF'}
          </button>
          <button
            type="button"
            className="ys-button ys-button--secondary"
            disabled={pending}
            onClick={() => download(summaryCsv(filtered), `${exportName('daily')}.csv`)}
          >
            CSV סיכום יומי
          </button>
          <button
            type="button"
            className="ys-button ys-button--secondary"
            disabled={pending}
            onClick={() => download(weeklyCsv(filtered), `${exportName('weekly')}.csv`)}
          >
            CSV סיכום שבועי
          </button>
          <button
            type="button"
            className="ys-button ys-button--secondary"
            disabled={pending}
            onClick={() => download(reportCsv(filtered), `${exportName('detail')}.csv`)}
          >
            CSV פירוט נוכחות
          </button>
        </div>
        {error && (
          <p role="alert" className="admin-feedback admin-feedback--error">
            <span>{error}</span>
          </p>
        )}
        <details className="report-explanation">
          <summary>מה נכלל בדוח?</summary>
          <p className="report-note">
            שעות נוכחות וסיווג לפי כללי התחנה, ללא חישוב שכר כספי. ניכוי הפסקות מוצג בנפרד. רשומות
            פתוחות, מסומנות וחופפות אינן נספרות. משמרת לילה מוצגת בשלמותה ביום הכניסה, לפי אזור הזמן
            של התחנה. תיקונים ידניים כלולים ומסומנים.
          </p>
        </details>
        <div className="report-updated">
          <small>
            הדוח נכון ל-
            {new Date(report.generatedAt).toLocaleString('he-IL', {
              timeZone: report.timezone,
            })}
            .
          </small>
          <button
            type="button"
            className="ys-button ys-button--tertiary ys-button--sm"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            רענון נתונים
          </button>
        </div>
      </section>
      <section aria-label="פירוט שעות עובדים" className="report-workers">
        {filtered.people.length > 0 && (
          <div className="report-worker-head" aria-hidden="true">
            <span>עובד</span>
            {WORKER_COLUMNS.map((column) => (
              <span key={column}>{column}</span>
            ))}
            <span>סה״כ</span>
            <span />
          </div>
        )}
        {!filtered.people.length && (
          <div className="ys-empty admin-empty-panel">
            <p className="ys-empty-title">אין עובדים להצגה בתקופה זו.</p>
          </div>
        )}
        {filtered.people.map((person) => {
          const entries = filtered.entries.filter((e) => e.personId === person.id);
          return (
            <PersonHours
              key={`${person.id}:${personId}:${report.from}:${report.to}`}
              person={person}
              initiallyOpen={!!personId}
              report={{ ...filtered, people: [person], entries }}
            />
          );
        })}
      </section>
    </div>
  );
}
