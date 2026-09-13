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
import { PersonHours } from './PersonHours';

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
      setError('יצירת ה־PDF נכשלה. נסו שוב או הורידו CSV.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="hours-report" dir="rtl" aria-busy={pending}>
      <Link href={`/stations/${stationId}`}>← חזרה לתחנה</Link>
      <header>
        <p className="report-eyebrow">{report.station}</p>
        <h1>דוח שעות עבודה</h1>
        <p>סיכום הצוות, פירוט יומי וייצוא להנהלת חשבונות</p>
      </header>
      <Link href={`/stations/${stationId}/reports/settings`}>הגדרת כללי שעות ותוספות →</Link>
      <section className="report-panel" aria-label="בחירת תקופה ועובד">
        <form
          key={`${report.from}-${report.to}`}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            navigate(String(data.get('from')), String(data.get('to')));
          }}
          className="report-filters"
        >
          <label>
            מתאריך
            <input required type="date" name="from" defaultValue={report.from} />
          </label>
          <label>
            עד תאריך
            <input required type="date" name="to" defaultValue={report.to} />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? 'טוענים…' : 'הצגת דוח'}
          </button>
        </form>
        <div className="report-week-buttons">
          <button
            disabled={pending}
            onClick={() => navigate(addDays(report.from, -7), addDays(report.to, -7))}
          >
            שבוע קודם
          </button>
          <button
            disabled={pending}
            onClick={() => navigate(weekStart(today, 0), addDays(weekStart(today, 0), 6))}
          >
            השבוע הנוכחי
          </button>
          <button
            disabled={pending}
            onClick={() => navigate(addDays(report.from, 7), addDays(report.to, 7))}
          >
            שבוע הבא
          </button>
        </div>
        <label className="report-person">
          עובד / כל הצוות
          <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
            <option value="">כל הצוות ({report.people.length})</option>
            {report.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.code ? ` · ${p.code}` : ''}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="report-stats">
        <section>
          <span>שעות סגורות בתקופה</span>
          <strong dir="ltr">{duration(total)}</strong>
          <small>{(total / 3600).toFixed(2)} שעות עשרוניות</small>
        </section>
        <section>
          <span>עובדים בדוח</span>
          <strong>{filtered.people.length}</strong>
          <small>כולל עובדים ללא שעות</small>
        </section>
        <section>
          <span>רשומות לבדיקה</span>
          <strong>{flagged}</strong>
          <small>פתוחות / מסומנות / חופפות</small>
        </section>
      </div>
      <RateBreakdown entries={filtered.entries} />
      <section className="report-panel">
        <h2>ייצוא {personId ? 'העובד שנבחר' : 'כל הצוות'}</h2>
        <p className="report-period">
          <bdi>
            {report.from} — {report.to}
          </bdi>
          <bdi>{report.timezone}</bdi>
        </p>
        <div className="report-exports">
          <button disabled={busy || pending} onClick={pdf}>
            {busy ? 'מכינים PDF…' : 'הורדת PDF'}
          </button>
          <button
            disabled={pending}
            onClick={() => download(summaryCsv(filtered), `${exportName('daily')}.csv`)}
          >
            CSV סיכום יומי
          </button>
          <button
            disabled={pending}
            onClick={() => download(weeklyCsv(filtered), `${exportName('weekly')}.csv`)}
          >
            CSV סיכום שבועי
          </button>
          <button
            disabled={pending}
            onClick={() => download(reportCsv(filtered), `${exportName('detail')}.csv`)}
          >
            CSV פירוט נוכחות
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        <details className="report-explanation">
          <summary>מה נכלל בדוח?</summary>
          <p className="report-note">
            שעות נוכחות וסיווג לפי כללי התחנה, ללא חישוב שכר כספי. ניכוי הפסקות מוצג בנפרד. רשומות
            פתוחות, מסומנות וחופפות אינן נספרות. משמרת לילה מוצגת בשלמותה ביום הכניסה, לפי אזור הזמן
            של התחנה. תיקונים ידניים כלולים ומסומנים.
          </p>
        </details>
        <small className="report-updated">
          <span>
            הדוח נכון ל־
            {new Date(report.generatedAt).toLocaleString('he-IL', {
              timeZone: report.timezone,
            })}
            .
          </span>
          <button
            className="report-refresh"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            רענון נתונים
          </button>
        </small>
      </section>
      <section aria-label="פירוט שעות עובדים" className="report-workers">
        {!filtered.people.length && <p>אין עובדים להצגה בתקופה זו.</p>}
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
    </main>
  );
}
