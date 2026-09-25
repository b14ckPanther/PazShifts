'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  hoursExportName,
  addDays,
  duration,
  reportCsv,
  summaryCsv,
  weeklyCsv,
  weekStart,
  type HoursReport,
} from '@yellowshifts/reports';
import { HoursTable, RateBreakdown, PageHeader } from '@yellowshifts/ui';
import type { StationWithMembership } from '@yellowshifts/types';
import { WorkerHeader } from '@/app/components/WorkerHeader';
import { StationSelector } from '@/app/components/StationSelector';
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
  station,
  user,
  profile,
  memberships,
}: {
  report: HoursReport;
  stationId: string;
  today: string;
  stations: { id: string; name: string }[];
  station?: { id: string; name: string; code: string; timezone?: string };
  user?: { id: string; email?: string | null };
  profile?: { fullName?: string | null } | null;
  memberships?: readonly StationWithMembership[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = report.entries.reduce((s, e) => s + e.seconds, 0);
  const flagged = new Set(report.entries.filter((e) => e.status !== 'הושלמה').map((e) => e.id))
    .size;
  const exportName = (kind: 'pdf' | 'daily' | 'weekly' | 'detail') =>
    hoursExportName(report, kind, report.people[0]?.name || 'עובד');
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
      await exportHoursPdf(report, exportName('pdf'));
    } catch {
      setError('לא ניתן ליצור PDF כרגע. נסו שוב או הורידו CSV.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {station && user && (
        <WorkerHeader
          station={station}
          user={user}
          profile={profile}
          role={memberships?.find((m) => m.station.id === stationId)?.membership.role}
          activeTab="hours"
          pageTitle="השעות שלי"
        />
      )}
      <main className="worker-hours" dir="rtl" aria-busy={pending}>
        <PageHeader
          title="השעות שלי"
          description={`הנוכחות שלך בתחנת ${report.station}, יום אחרי יום.`}
        />
        {memberships && memberships.length > 1 && (
          <StationSelector memberships={memberships} activeStationId={stationId} />
        )}
        <section className="worker-hours-controls">
          {!memberships && stations.length > 1 && (
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
            onClick={() => navigate(weekStart(today, 0), addDays(weekStart(today, 0), 6))}
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
            onClick={() => saveCsv(summaryCsv(report), `${exportName('daily')}.csv`)}
          >
            CSV יומי
          </button>
          <button
            disabled={pending}
            onClick={() => saveCsv(weeklyCsv(report), `${exportName('weekly')}.csv`)}
          >
            CSV שבועי
          </button>
          <button
            disabled={pending}
            onClick={() => saveCsv(reportCsv(report), `${exportName('detail')}.csv`)}
          >
            CSV מפורט
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        <p>
          משמרות פתוחות או מסומנות לבדיקה אינן נספרות. משמרת לילה מוצגת בשלמותה ביום הכניסה, לפי
          אזור הזמן של התחנה. שעות נוכחות אינן חישוב שכר.
        </p>
        <footer className="worker-hours-refresh">
          <small>
            עודכן לאחרונה:{' '}
            <bdi>
              {new Date(report.generatedAt).toLocaleString('he-IL', { timeZone: report.timezone })}
            </bdi>
          </small>
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            {pending ? 'מרעננים…' : 'רענון הנתונים'}
          </button>
        </footer>
      </section>
    </main>
  </>
  );
}
