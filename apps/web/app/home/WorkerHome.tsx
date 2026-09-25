'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MobileHome } from '@yellowshifts/database/public';
import { ClockIcon, CalendarIcon, RefreshIcon } from '@yellowshifts/icons';
import { elapsedClock, nextHomeShift } from './home-view';

export function WorkerHome({
  data,
  name,
  station,
}: {
  data: MobileHome | null;
  name: string;
  station: string;
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
  return (
    <div className="worker-home-content">
      <header className="worker-home-welcome">
        <div>
          <span>היום שלכם, במקום אחד</span>
          <h1>שלום, {name}</h1>
        </div>
        <button
          aria-label="רענון נתוני המשמרת"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          <RefreshIcon size={20} />
        </button>
      </header>
      {!data ? (
        <section className="worker-home-empty" role="alert">
          <h2>לא הצלחנו לטעון את המשמרות</h2>
          <p>בדקו את החיבור ונסו לרענן. נתוני הנוכחות לא השתנו.</p>
        </section>
      ) : (
        <>
          {stale && (
            <p className="worker-home-stale" role="status">
              ממתינים לעדכון מהשרת. הנוכחות המוצגת עשויה להשתנות.
            </p>
          )}
          {data.active && clock ? (
            <section className="worker-active-card" aria-label="המשמרת הפעילה שלך">
              <div className="worker-active-top">
                <span className="worker-active-status">
                  <i />
                  {stale ? 'לפי העדכון האחרון' : 'במשמרת עכשיו'}
                </span>
                <span>{data.activeStation || 'תחנה פעילה'}</span>
              </div>
              <div className="worker-active-ring">
                <svg viewBox="0 0 240 240" aria-hidden="true">
                  <circle className="worker-ring-track" cx="120" cy="120" r="106" />
                  <circle
                    className="worker-ring-progress"
                    cx="120"
                    cy="120"
                    r="106"
                    pathLength="60"
                    strokeDasharray={`${clock.seconds % 60} 60`}
                  />
                </svg>
                <div>
                  <span>זמן מתחילת המשמרת</span>
                  <strong dir="ltr" role="timer" aria-live="off">
                    {clock.label}
                  </strong>
                  <small>כניסה ב־{time(data.active.clock_in_at, data.activeTimezone)}</small>
                </div>
              </div>
              <div className="worker-active-bottom">
                <span>הספירה מתעדכנת בזמן אמת</span>
              </div>
            </section>
          ) : (
            <section className="worker-home-empty">
              <div className="worker-home-symbol">
                <ClockIcon size={26} />
              </div>
              <h2>כרגע אין משמרת פעילה</h2>
              <p>אחרי דיווח כניסה, זמן המשמרת שלכם יופיע כאן.</p>
            </section>
          )}
          <section className="worker-home-next">
            <div className="worker-home-section-title">
              <CalendarIcon size={18} />
              <h2>המשמרת הבאה שלך</h2>
            </div>
            {next ? (
              <>
                <p>
                  {new Intl.DateTimeFormat('he-IL', {
                    timeZone: data.timezone,
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  }).format(new Date(next.start_at))}
                </p>
                <strong dir="ltr">
                  {time(next.start_at, data.timezone)} <span>—</span>{' '}
                  {time(next.end_at, data.timezone)}
                </strong>
                {new Intl.DateTimeFormat('en-CA', { timeZone: data.timezone }).format(
                  new Date(next.start_at)
                ) !==
                  new Intl.DateTimeFormat('en-CA', { timeZone: data.timezone }).format(
                    new Date(next.end_at)
                  ) && <small>מסתיימת למחרת</small>}
                <p>{station}</p>
              </>
            ) : (
              <p>אין משמרת קרובה שפורסמה ב־28 הימים הקרובים.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
