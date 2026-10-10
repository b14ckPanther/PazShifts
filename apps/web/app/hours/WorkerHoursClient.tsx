'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  hoursExportName,
  hoursMinutes,
  hoursSummary,
  reportCsv,
  summaryCsv,
  weeklyCsv,
  type HoursReport,
} from '@yellowshifts/reports';
import { HoursTable, RateBreakdown, PageHeader, PeriodPicker, periodLabel } from '@yellowshifts/ui';
import { DocumentGlyph, RefreshGlyph, SheetGlyph, AlertGlyph } from '@yellowshifts/icons';
import { PumpDigits } from '@/app/components/WorkerVisuals';
import type { StationWithMembership } from '@yellowshifts/types';
import { WorkerHeader } from '@/app/components/WorkerHeader';
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
  const summary = hoursSummary(report.entries);
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
          memberships={memberships}
          activeTab="hours"
          pageTitle="השעות שלי"
        />
      )}
      <main className="worker-hours" dir="rtl" aria-busy={pending}>
        <PageHeader title="השעות שלי" />
        {!memberships && stations.length > 1 && (
          <label className="worker-hours-station">
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
        <section className="worker-hours-card" aria-label="בחירת תקופה">
          <PeriodPicker
            from={report.from}
            to={report.to}
            today={today}
            pending={pending}
            onChange={(from, to) => navigate(from, to)}
          />
        </section>

        <section className="worker-hours-summary" aria-label="סיכום התקופה">
          <div className="worker-hours-total">
            <span>סה״כ שעות בתקופה</span>
            <strong>
              <PumpDigits value={hoursMinutes(summary.seconds)} />
            </strong>
            <p>
              <span>
                <b>{summary.days}</b> ימי עבודה
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <b>{summary.shifts}</b> משמרות
              </span>
            </p>
            <RateBreakdown entries={report.entries} />
          </div>
          {summary.attention > 0 && (
            <p className="worker-hours-attention" role="status">
              <AlertGlyph size={18} variant="duo" />
              {summary.attention === 1
                ? 'משמרת אחת לא נספרה'
                : `${summary.attention} משמרות לא נספרו`}{' '}
              – פתוחה או ממתינה לבדיקת המנהל.
            </p>
          )}
        </section>

        <section className="worker-hours-card" aria-labelledby="worker-shifts-title">
          <h2 id="worker-shifts-title">משמרות</h2>
          <HoursTable report={report} />
        </section>

        <section className="worker-hours-card worker-hours-export" aria-label="הורדת הדוח">
          <button
            className="ys-button ys-button--primary ys-button--lg"
            onClick={pdf}
            disabled={busy || pending}
            aria-busy={busy || undefined}
          >
            <DocumentGlyph size={20} variant="solid" />
            {busy ? 'מכינים PDF…' : 'הורדת דוח PDF'}
          </button>
          <p className="worker-hours-export-scope">{periodLabel(report.from, report.to)}</p>
          {error && (
            <p className="worker-hours-error" role="alert">
              {error}
            </p>
          )}
          <details className="worker-hours-csv">
            <summary>
              <SheetGlyph size={18} variant="duo" />
              קבצים לאקסל (CSV)
            </summary>
            <div>
              <button
                className="ys-button ys-button--secondary ys-button--sm"
                disabled={pending}
                onClick={() => saveCsv(summaryCsv(report), `${exportName('daily')}.csv`)}
              >
                סיכום יומי
              </button>
              <button
                className="ys-button ys-button--secondary ys-button--sm"
                disabled={pending}
                onClick={() => saveCsv(weeklyCsv(report), `${exportName('weekly')}.csv`)}
              >
                סיכום שבועי
              </button>
              <button
                className="ys-button ys-button--secondary ys-button--sm"
                disabled={pending}
                onClick={() => saveCsv(reportCsv(report), `${exportName('detail')}.csv`)}
              >
                פירוט משמרות
              </button>
            </div>
          </details>
          <footer className="worker-hours-refresh">
            <small>
              עודכן{' '}
              <bdi>
                {new Date(report.generatedAt).toLocaleTimeString('he-IL', {
                  timeZone: report.timezone,
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </bdi>
            </small>
            <button
              type="button"
              className="ys-button ys-button--ghost ys-button--sm"
              disabled={pending}
              aria-busy={pending}
              onClick={() => startTransition(() => router.refresh())}
            >
              <RefreshGlyph size={16} />
              {pending ? 'מרעננים…' : 'רענון'}
            </button>
          </footer>
        </section>
      </main>
    </>
  );
}
