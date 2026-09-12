'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import {
  addDays,
  duration,
  reportCsv,
  summaryCsv,
  weeklyCsv,
  weekStart,
  type HoursReport,
} from '@yellowshifts/reports';
import { HoursTable, RateBreakdown } from '@yellowshifts/ui';
import './hours.css';

function saveCsv(value: string, name: string) {
  const url = URL.createObjectURL(new Blob([value], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function WorkerHoursClient({
  report,
  stationId,
  today,
  stations,
}: {
  report: HoursReport;
  stationId: string;
  today: string;
  stations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = report.entries.reduce((s, e) => s + e.seconds, 0);
  const flagged = new Set(report.entries.filter((e) => e.status !== 'הושלמה').map((e) => e.id))
    .size;
  const file = `my-hours-${stationId}-${report.from}-${report.to}`;
  function navigate(from: string, to: string, id = stationId) {
    startTransition(() =>
      router.push(`/hours?stationId=${encodeURIComponent(id)}&from=${from}&to=${to}`)
    );
  }
  async function pdf() {
    setBusy(true);
    setError('');
    try {
      const { exportHoursPdf } = await import('@yellowshifts/reports/pdf');
      await exportHoursPdf(report, file);
    } catch {
      setError('לא ניתן ליצור PDF כרגע. נסו שוב או הורידו CSV.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="worker-hours" dir="rtl" aria-busy={pending}>
      <header>
        <Link href={`/?stationId=${stationId}`}>← המשמרות שלי</Link>
        <p>{report.station}</p>
        <h1>השעות שלי</h1>
        <span>הנוכחות שלך, יום אחרי יום</span>
      </header>
      <section className="worker-hours-controls">
        {stations.length > 1 && (
          <label>
            תחנה
            <select
              value={stationId}
              onChange={(e) => navigate(report.from, report.to, e.target.value)}
            >
              {stations.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <form
          key={`${report.from}-${report.to}`}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            navigate(String(f.get('from')), String(f.get('to')));
          }}
        >
          <label>
            מתאריך
            <input type="date" name="from" required defaultValue={report.from} />
          </label>
          <label>
            עד תאריך
            <input type="date" name="to" required defaultValue={report.to} />
          </label>
          <button disabled={pending}>{pending ? 'טוענים…' : 'הצגת שעות'}</button>
        </form>
        <div className="hours-week-nav">
          <button
            disabled={pending}
            onClick={() => navigate(addDays(report.from, -7), addDays(report.to, -7))}
          >
            שבוע קודם
          </button>
          <button
            disabled={pending}
            onClick={() =>
              navigate(
                weekStart(today, report.rateWeekStartsOn),
                addDays(weekStart(today, report.rateWeekStartsOn), 6)
              )
            }
          >
            השבוע
          </button>
          <button
            disabled={pending}
            onClick={() => navigate(addDays(report.from, 7), addDays(report.to, 7))}
          >
            שבוע הבא
          </button>
        </div>
      </section>
      <section className="worker-hours-total">
        <div>
          <span>סך שעות סגורות</span>
          <strong dir="ltr">{duration(total)}</strong>
        </div>
        <div>
          <span>רשומות לבדיקה</span>
          <strong>{flagged}</strong>
        </div>
      </section>
      <section className="worker-hours-table">
        <h2>פירוט שעות העבודה</h2>
        <RateBreakdown entries={report.entries} />
        <HoursTable report={report} />
      </section>
      <section className="worker-hours-exports">
        <h2>הדוח שלך להורדה</h2>
        <div>
          <button onClick={pdf} disabled={busy || pending}>
            {busy ? 'מכינים PDF…' : 'הורדת PDF'}
          </button>
          <button
            disabled={pending}
            onClick={() => saveCsv(summaryCsv(report), `${file}-daily.csv`)}
          >
            CSV יומי
          </button>
          <button
            disabled={pending}
            onClick={() => saveCsv(weeklyCsv(report), `${file}-weekly.csv`)}
          >
            CSV שבועי
          </button>
          <button
            disabled={pending}
            onClick={() => saveCsv(reportCsv(report), `${file}-detail.csv`)}
          >
            CSV מפורט
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        <p>
          משמרות פתוחות או מסומנות לבדיקה אינן נספרות. משמרות לילה מחולקות לפי יום באזור הזמן של
          התחנה. שעות נוכחות אינן חישוב שכר.
        </p>
        <small>
          נכון ל־
          {new Date(report.generatedAt).toLocaleString('he-IL', { timeZone: report.timezone })}
        </small>
        <button disabled={pending} onClick={() => startTransition(() => router.refresh())}>
          רענון
        </button>
      </section>
    </main>
  );
}
