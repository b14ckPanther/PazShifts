'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MobileHome } from '@yellowshifts/database/public';
import {
  BriefcaseIcon,
  ChevronLeftIcon,
  ClockIcon,
  CalendarIcon,
  RefreshIcon,
  NfcTagIcon,
  OfflineIcon,
  PendingIcon,
} from '@yellowshifts/icons';
import { StatusBadge } from '@yellowshifts/ui';
import { NavigationLink as Link } from '../components/NavigationLink';
import { elapsedClock, nextHomeShift } from './home-view';

export function WorkerHome({
  data,
  name,
  station,
  nextSteps,
}: {
  data: MobileHome | null;
  name: string;
  station: string;
  nextSteps?: {
    shiftsHref: string;
    availabilityHref: string;
    availabilitySubmitted: boolean | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(data?.fetchedAt ?? 0);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = () => {
      if (document.visibilityState === 'visible') startTransition(() => router.refresh());
    };
    const poll = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [router]);
  const clock = data?.active ? elapsedClock(data.active.clock_in_at, now) : null;
  const stale = data && now - data.fetchedAt > 90000;
  const next = data ? nextHomeShift(data, now) : null;
  const time = (value: string, zone: string) =>
    new Intl.DateTimeFormat('he-IL', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  const nextDate = (value: string) =>
    new Intl.DateTimeFormat('he-IL', {
      timeZone: data?.timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(value));
  const endsNextDay = (shift: { start_at: string; end_at: string }) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: data?.timezone }).format(
      new Date(shift.start_at)
    ) !==
    new Intl.DateTimeFormat('en-CA', { timeZone: data?.timezone }).format(new Date(shift.end_at));
  const nextShift = next ? (
    <>
      <p className="worker-home-next-date">{nextDate(next.start_at)}</p>
      <p className="worker-home-next-time ys-num" dir="ltr">
        {time(next.start_at, data!.timezone)}
        <span aria-hidden="true">–</span>
        {time(next.end_at, data!.timezone)}
      </p>
      <p className="worker-home-next-meta">
        <span>{station}</span>
        {endsNextDay(next) && <span className="worker-home-chip">מסתיימת למחרת</span>}
      </p>
    </>
  ) : (
    <p className="worker-home-next-none">אין משמרת קרובה שפורסמה ב־28 הימים הקרובים.</p>
  );
  return (
    <div className="worker-home-content">
      <header className="worker-home-welcome">
        <h1>שלום, {name}</h1>
        <button
          type="button"
          className="ys-button ys-button--secondary ys-button--icon"
          aria-label="רענון נתוני המשמרת"
          aria-busy={pending || undefined}
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          <RefreshIcon size={20} className={pending ? 'worker-home-spin' : undefined} />
        </button>
      </header>
      {!data ? (
        <section className="worker-home-panel worker-home-error" role="alert">
          <span className="worker-home-symbol" aria-hidden="true">
            <OfflineIcon size={24} />
          </span>
          <h2>לא הצלחנו לטעון את המשמרות</h2>
          <p>בדקו את החיבור ונסו לרענן. נתוני הנוכחות לא השתנו.</p>
        </section>
      ) : (
        <>
          {stale && (
            <p className="worker-home-stale" role="status">
              <PendingIcon size={16} aria-hidden="true" />
              ממתינים לעדכון מהשרת. הנוכחות המוצגת עשויה להשתנות.
            </p>
          )}
          {data.active && clock ? (
            <section className="worker-live" aria-label="המשמרת הפעילה שלך">
              <div className="worker-live-top">
                <span className="ys-status ys-status--live worker-live-status">
                  <span className="ys-status-pulse" aria-hidden="true" />
                  {stale ? 'לפי העדכון האחרון' : 'במשמרת עכשיו'}
                </span>
                <span className="worker-live-caption">הספירה מתעדכנת בזמן אמת</span>
              </div>
              <div className="worker-live-clock">
                <span>זמן מתחילת המשמרת</span>
                <strong className="ys-num" dir="ltr" role="timer" aria-live="off">
                  {clock.label}
                </strong>
              </div>
              <dl className="worker-live-facts">
                <div>
                  <dt>כניסה</dt>
                  <dd className="ys-num">{time(data.active.clock_in_at, data.activeTimezone)}</dd>
                </div>
                <div>
                  <dt>תחנה</dt>
                  <dd>{data.activeStation || 'תחנה פעילה'}</dd>
                </div>
              </dl>
              <p className="worker-live-hint">
                <NfcTagIcon size={18} aria-hidden="true" />
                לסיום המשמרת, סרקו שוב את תג התחנה ואשרו יציאה.
              </p>
            </section>
          ) : (
            <section
              className="worker-home-panel worker-home-next is-hero"
              aria-labelledby="next-shift-title"
            >
              <div className="worker-home-section-title">
                <CalendarIcon size={18} aria-hidden="true" />
                <h2 id="next-shift-title">המשמרת הבאה שלך</h2>
              </div>
              {nextShift}
            </section>
          )}
          {data.active && clock ? (
            <section
              className="worker-home-panel worker-home-next"
              aria-labelledby="next-shift-title"
            >
              <div className="worker-home-section-title">
                <CalendarIcon size={18} aria-hidden="true" />
                <h2 id="next-shift-title">המשמרת הבאה שלך</h2>
              </div>
              {nextShift}
            </section>
          ) : (
            <section className="worker-home-idle">
              <span className="worker-home-symbol" aria-hidden="true">
                <ClockIcon size={22} />
              </span>
              <div>
                <h2>כרגע אין משמרת פעילה</h2>
                <p>אחרי דיווח כניסה, זמן המשמרת שלכם יופיע כאן.</p>
              </div>
            </section>
          )}
        </>
      )}
      {nextSteps && (
        <nav className="worker-home-steps" aria-label="הצעדים הבאים">
          <Link href={nextSteps.shiftsHref}>
            <BriefcaseIcon size={20} aria-hidden="true" />
            <span>
              <strong>המשמרות שלי השבוע</strong>
              <small>סידור העבודה שפורסם</small>
            </span>
            <ChevronLeftIcon size={18} aria-hidden="true" />
          </Link>
          <Link href={nextSteps.availabilityHref}>
            <CalendarIcon size={20} aria-hidden="true" />
            <span>
              <strong>הזמינות לשבוע הבא</strong>
              {nextSteps.availabilitySubmitted === null ? (
                <small>הגשת זמינות שבועית</small>
              ) : nextSteps.availabilitySubmitted ? (
                <StatusBadge status="approved" label="הוגשה זמינות" />
              ) : (
                <StatusBadge status="pending" label="טרם הוגשה זמינות" />
              )}
            </span>
            <ChevronLeftIcon size={18} aria-hidden="true" />
          </Link>
        </nav>
      )}
    </div>
  );
}
