'use client';
import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { PeriodPicker, RateBreakdown, periodLabel } from '@yellowshifts/ui';
import { DownloadIcon, RefreshIcon } from '@yellowshifts/icons';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import {
  decimalHours,
  hoursExportName,
  hoursMinutes,
  hoursSummary,
  payRateKeys,
  payRates,
  rateTotals,
  reportCsv,
  summaryCsv,
  weeklyCsv,
  type HoursReport,
  type ReportPerson,
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
  const [showIdle, setShowIdle] = useState(false);
  const [busy, setBusy] = useState('');
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
  const byPerson = useMemo(() => {
    const map = new Map<string, HoursReport['entries']>();
    for (const entry of filtered.entries)
      map.set(entry.personId, [...(map.get(entry.personId) ?? []), entry]);
    return map;
  }, [filtered.entries]);
  const summary = hoursSummary(filtered.entries);
  // One pass over the whole team: shared percent columns plus each worker's totals.
  const { rates, personRates } = useMemo(() => {
    const team: Record<string, number> = {};
    const personRates = new Map<string, Record<string, number>>();
    for (const [entry, split] of payRates(report.entries)) {
      const own = personRates.get(entry.personId) ?? {};
      for (const [rate, seconds] of Object.entries(split)) {
        own[rate] = (own[rate] || 0) + seconds;
        team[rate] = (team[rate] || 0) + seconds;
      }
      personRates.set(entry.personId, own);
    }
    return { rates: payRateKeys(report.entries, team), personRates };
  }, [report.entries]);
  const unclassified = rateTotals(filtered.entries).unclassified || 0;
  const active = filtered.people.filter((p) => byPerson.has(p.id));
  const idle = filtered.people.filter((p) => !byPerson.has(p.id));
  const selected = personId ? filtered.people[0] : undefined;
  const exportName = (kind: 'pdf' | 'daily' | 'weekly' | 'detail', person?: ReportPerson) =>
    hoursExportName(filtered, kind, person ? person.name || 'עובד' : undefined);

  function navigate(from: string, to: string) {
    startTransition(() => router.push(`?from=${from}&to=${to}`));
  }
  async function pdf(person?: ReportPerson) {
    setBusy(person?.id ?? 'all');
    setError('');
    try {
      const { exportHoursPdf } = await import('@/app/lib/hours-pdf');
      const scoped = person
        ? {
            ...filtered,
            people: [person],
            entries: filtered.entries.filter((e) => e.personId === person.id),
          }
        : filtered;
      await exportHoursPdf(scoped, exportName('pdf', person ?? selected));
    } catch {
      setError('יצירת ה-PDF נכשלה. נסו שוב או הורידו CSV.');
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="hours-report" aria-busy={pending}>
      <div className="ys-page-header report-header">
        <div className="ys-page-header-text">
          <div className="ys-page-header-title">
            <h1>דוח שעות</h1>
          </div>
        </div>
      </div>

      <nav className="station-nav-pills" aria-label="דוחות ושעות">
        <Link href={`/stations/${stationId}/reports`} aria-current="page">
          דוח שעות
        </Link>
        <Link href={`/stations/${stationId}/reports/settings`}>הגדרת כללי שעות ותוספות</Link>
      </nav>

      <section className="report-panel report-controls" aria-label="בחירת תקופה ועובד">
        <PeriodPicker
          from={report.from}
          to={report.to}
          today={today}
          pending={pending}
          onChange={navigate}
        />
        <div className="ys-form-field report-person">
          <label className="ys-label" htmlFor="report-person">
            עובד
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
      </section>

      <section className="report-summary" aria-label="סיכום התקופה">
        <div className="report-total">
          <span>{selected ? selected.name : 'סה״כ שעות הצוות'}</span>
          <strong>
            <bdi>{hoursMinutes(summary.seconds)}</bdi>
          </strong>
          <small>
            <bdi>{decimalHours(summary.seconds)}</bdi> שעות עשרוניות
          </small>
        </div>
        <dl className="report-facts">
          {!selected && (
            <div>
              <dt>עובדים עם שעות</dt>
              <dd>
                <bdi>{active.length}</bdi>
                <small> / {filtered.people.length}</small>
              </dd>
            </div>
          )}
          <div>
            <dt>ימי עבודה</dt>
            <dd>
              <bdi>{summary.days}</bdi>
            </dd>
          </div>
          <div>
            <dt>משמרות</dt>
            <dd>
              <bdi>{summary.shifts}</bdi>
            </dd>
          </div>
          {summary.attention > 0 && (
            <div className="is-attention">
              <dt>לא נספרו</dt>
              <dd>
                <bdi>{summary.attention}</bdi>
              </dd>
            </div>
          )}
        </dl>
        <RateBreakdown entries={filtered.entries} compact />
        {unclassified > 0 && (
          <p className="report-rules-hint">
            ללא כללי שעות לתחנה, החלוקה היא 8 שעות ביום ב-100%, 2 שעות ב-125% והשאר ב-150%.{' '}
            <Link href={`/stations/${stationId}/reports/settings`}>הגדרת כללים</Link>
          </p>
        )}
      </section>

      <section className="report-panel report-export" aria-label="ייצוא">
        <div className="report-export-main">
          <button
            type="button"
            className="ys-button ys-button--primary"
            disabled={!!busy || pending}
            aria-busy={busy === 'all' || undefined}
            onClick={() => pdf()}
          >
            <DownloadIcon size={18} aria-hidden="true" />
            {busy === 'all' ? 'מכינים PDF…' : selected ? 'הורדת PDF לעובד' : 'הורדת PDF לכל הצוות'}
          </button>
          <p>
            <bdi>{periodLabel(report.from, report.to)}</bdi>
            {selected ? ` · ${selected.name}` : ''}
          </p>
        </div>
        {error && (
          <p role="alert" className="admin-feedback admin-feedback--error">
            <span>{error}</span>
          </p>
        )}
        <div className="report-export-more">
          <details>
            <summary>קבצים לאקסל (CSV)</summary>
            <div className="report-exports">
              <button
                type="button"
                className="ys-button ys-button--secondary ys-button--sm"
                disabled={pending}
                onClick={() =>
                  download(summaryCsv(filtered), `${exportName('daily', selected)}.csv`)
                }
              >
                סיכום יומי
              </button>
              <button
                type="button"
                className="ys-button ys-button--secondary ys-button--sm"
                disabled={pending}
                onClick={() =>
                  download(weeklyCsv(filtered), `${exportName('weekly', selected)}.csv`)
                }
              >
                סיכום שבועי
              </button>
              <button
                type="button"
                className="ys-button ys-button--secondary ys-button--sm"
                disabled={pending}
                onClick={() =>
                  download(reportCsv(filtered), `${exportName('detail', selected)}.csv`)
                }
              >
                פירוט משמרות
              </button>
            </div>
          </details>
          <button
            type="button"
            className="ys-button ys-button--ghost ys-button--sm"
            disabled={pending}
            title={`נכון ל-${new Date(report.generatedAt).toLocaleTimeString('he-IL', {
              timeZone: report.timezone,
              hour: '2-digit',
              minute: '2-digit',
            })}`}
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshIcon size={16} aria-hidden="true" />
            {pending ? 'מרעננים…' : 'רענון'}
          </button>
        </div>
      </section>

      <section
        aria-label="שעות לפי עובד"
        className="report-workers"
        style={{ '--report-rates': rates.length } as CSSProperties}
      >
        {active.length > 0 && (
          <div className="report-worker-head" aria-hidden="true">
            <span>עובד</span>
            <span>ימים</span>
            <span>משמרות</span>
            {rates.map((rate) => (
              <span key={rate}>{rate}%</span>
            ))}
            <span>סה״כ</span>
            <span />
          </div>
        )}
        {!active.length && (
          <div className="ys-empty admin-empty-panel">
            <p className="ys-empty-title">
              {selected ? 'לא נרשמו משמרות לעובד בתקופה זו.' : 'לא נרשמו משמרות בתקופה זו.'}
            </p>
          </div>
        )}
        {[...active, ...(showIdle ? idle : [])].map((person) => (
          <PersonHours
            key={`${person.id}:${personId}:${report.from}:${report.to}`}
            person={person}
            rates={rates}
            rateTotals={personRates.get(person.id)}
            initiallyOpen={!!personId}
            busy={busy === person.id}
            onPdf={active.length > 1 || !personId ? () => pdf(person) : undefined}
            report={{ ...filtered, people: [person], entries: byPerson.get(person.id) ?? [] }}
          />
        ))}
      </section>
      {!selected && idle.length > 0 && (
        <button
          type="button"
          className="report-idle-toggle"
          aria-pressed={showIdle}
          onClick={() => setShowIdle((value) => !value)}
        >
          {showIdle ? 'הסתרת עובדים ללא שעות' : `הצגת עובדים ללא שעות (${idle.length})`}
        </button>
      )}
    </div>
  );
}
