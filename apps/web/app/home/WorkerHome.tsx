'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MobileHome } from '@yellowshifts/database/public';
import { hoursMinutes } from '@yellowshifts/reports';
import {
  AvailabilityGlyph,
  CalendarGlyph,
  ChevronEndGlyph,
  HourglassGlyph,
  OfflineGlyph,
  PinGlyph,
  RefreshGlyph,
  TapGlyph,
} from '@yellowshifts/icons';
import { NavigationLink as Link } from '../components/NavigationLink';
import { DayBar, PumpDigits, minutesInZone } from '../components/WorkerVisuals';
import { NotificationPrompt } from '../components/PushNotifications';
import { elapsedClock, nextHomeShift } from './home-view';

const WEEKDAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return 'בוקר טוב';
  if (hour >= 12 && hour < 17) return 'צהריים טובים';
  if (hour >= 17 && hour < 22) return 'ערב טוב';
  return 'לילה טוב';
}

/** "בעוד 40 דקות", "בעוד 3 שעות", "מחר", "בעוד 4 ימים": how far the next shift is. */
function untilLabel(start: number, now: number, zone: string) {
  const rtf = new Intl.RelativeTimeFormat('he', { numeric: 'auto' });
  const minutes = Math.max(1, Math.round((start - now) / 60000));
  const day = (value: number) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(value);
  const days = Math.round((Date.parse(day(start)) - Date.parse(day(now))) / 86400000);
  if (days >= 1) return rtf.format(days, 'day');
  if (minutes < 90) return rtf.format(minutes, 'minute');
  return rtf.format(Math.round(minutes / 60), 'hour');
}

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
  const zone = data?.timezone ?? 'Asia/Jerusalem';
  // A single check-in stops at 12 hours (the server caps it); never count past that here.
  const clock = data?.active
    ? elapsedClock(data.active.clock_in_at, Math.min(now, Date.parse(data.active.clock_in_at) + 12 * 3600000))
    : null;
  const stale = data && now - data.fetchedAt > 90000;
  const next = data ? nextHomeShift(data, now) : null;
  const time = (value: string, tz: string) =>
    new Intl.DateTimeFormat('he-IL', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  const dateLabel = (value: string | number, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('he-IL', { timeZone: zone, ...options }).format(new Date(value));
  const endsNextDay = (shift: { start_at: string; end_at: string }) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(shift.start_at)) !==
    new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(shift.end_at));
  const greetingHour = Math.floor(minutesInZone(new Date(now || Date.now()).toISOString(), zone) / 60);

  // The scheduled shift behind the live attendance, when there is one, sets the gauge.
  const scheduled =
    data?.active?.scheduled_shift_id != null
      ? data.shifts.find((s) => s.id === data.active?.scheduled_shift_id)
      : undefined;
  const gauge =
    clock && scheduled
      ? (() => {
          const start = Date.parse(scheduled.start_at);
          const end = Date.parse(scheduled.end_at);
          const total = Math.max(1, end - start);
          const progress = Math.min(1, Math.max(0, (now - start) / total));
          const left = Math.round((end - now) / 1000);
          return { progress, left, end: scheduled.end_at };
        })()
      : null;
  const GAUGE_TICKS = 28;

  const weekDays = data
    ? Array.from({ length: 7 }, (_, i) => {
        const date = addDays(data.week, i);
        return {
          date,
          letter: WEEKDAY_LETTERS[i],
          day: Number(date.slice(8, 10)),
          shift: data.shifts.some((s) => s.shift_date === date),
          today: date === data.today,
          past: date < data.today,
        };
      })
    : [];
  const weekShiftCount = weekDays.filter((d) => d.shift).length;

  const nextShift = next ? (
    <>
      <div className="home-ticket-main">
        <div className="home-ticket-date" aria-hidden="true">
          <span>{dateLabel(next.start_at, { weekday: 'short' })}</span>
          <strong className="ys-num">{dateLabel(next.start_at, { day: 'numeric' })}</strong>
          <small>{dateLabel(next.start_at, { month: 'short' })}</small>
        </div>
        <div className="home-ticket-body">
          <p className="home-ticket-when">
            <span>{dateLabel(next.start_at, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <span className="home-ticket-until">{untilLabel(Date.parse(next.start_at), now, zone)}</span>
          </p>
          <p className="home-ticket-time ys-num" dir="ltr">
            {time(next.start_at, zone)}
            <span aria-hidden="true">–</span>
            {time(next.end_at, zone)}
          </p>
        </div>
      </div>
      <DayBar
        start={minutesInZone(next.start_at, zone)}
        end={minutesInZone(next.end_at, zone)}
        tone="crimson"
      />
      <p className="home-ticket-meta">
        <PinGlyph size={15} variant="duo" />
        <span>{station}</span>
        {endsNextDay(next) && <span className="home-chip">מסתיימת למחרת</span>}
      </p>
    </>
  ) : (
    <p className="home-ticket-none">אין משמרת קרובה שפורסמה ב-28 הימים הקרובים.</p>
  );

  return (
    <div className="worker-home-content">
      <header className="home-hello">
        <div>
          <p className="home-hello-date">
            {dateLabel(now || Date.now(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1>
            {greeting(greetingHour)}, {name}
          </h1>
        </div>
        <button
          type="button"
          className="home-refresh"
          aria-label="רענון נתוני המשמרת"
          aria-busy={pending || undefined}
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          <RefreshGlyph size={20} className={pending ? 'worker-home-spin' : undefined} />
        </button>
      </header>
      {!data ? (
        <section className="home-panel home-error" role="alert">
          <span className="home-well home-well--warning" aria-hidden="true">
            <OfflineGlyph size={24} />
          </span>
          <h2>לא הצלחנו לטעון את המשמרות</h2>
          <p>בדקו את החיבור ונסו לרענן. נתוני הנוכחות לא השתנו.</p>
        </section>
      ) : (
        <>
          {stale && (
            <p className="home-stale" role="status">
              <HourglassGlyph size={16} variant="duo" />
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
              </div>
              <div className="worker-live-clock">
                <span>זמן מתחילת המשמרת</span>
                <strong role="timer" aria-live="off">
                  <PumpDigits value={clock.label} />
                </strong>
              </div>
              {gauge && (
                <div className="worker-live-gauge">
                  <div
                    className="worker-live-ticks"
                    role="progressbar"
                    aria-label="התקדמות המשמרת המתוכננת"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(gauge.progress * 100)}
                  >
                    {Array.from({ length: GAUGE_TICKS }, (_, i) => (
                      <span
                        key={i}
                        data-on={i < Math.round(gauge.progress * GAUGE_TICKS) || undefined}
                      />
                    ))}
                  </div>
                  <p>
                    <span>
                      {gauge.left > 0 ? (
                        <>
                          נותרו{' '}
                          <b className="ys-num" dir="ltr">
                            {hoursMinutes(gauge.left)}
                          </b>{' '}
                          לסיום המתוכנן
                        </>
                      ) : (
                        'הסיום המתוכנן עבר'
                      )}
                    </span>
                    <span className="ys-num">סיום {time(gauge.end, data.activeTimezone)}</span>
                  </p>
                </div>
              )}
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
                <TapGlyph size={20} variant="duo" />
                לסיום המשמרת, סרקו שוב את תג התחנה ואשרו יציאה.
              </p>
            </section>
          ) : (
            <section className="home-panel home-ticket is-hero" aria-labelledby="next-shift-title">
              <h2 id="next-shift-title" className="home-panel-title">
                <CalendarGlyph size={18} variant="duo" />
                המשמרת הבאה שלך
              </h2>
              {nextShift}
            </section>
          )}
          {data.active && clock && next && (
            <Link href={nextSteps?.shiftsHref ?? '/'} className="home-next-row">
              <span className="home-ticket-date home-ticket-date--sm" aria-hidden="true">
                <span>{dateLabel(next.start_at, { weekday: 'short' })}</span>
                <strong className="ys-num">{dateLabel(next.start_at, { day: 'numeric' })}</strong>
              </span>
              <span className="home-next-row-text">
                <small>המשמרת הבאה · {untilLabel(Date.parse(next.start_at), now, zone)}</small>
                <strong className="ys-num" dir="ltr">
                  {time(next.start_at, zone)}–{time(next.end_at, zone)}
                </strong>
              </span>
              <ChevronEndGlyph size={18} />
            </Link>
          )}
          <section className="home-week" aria-labelledby="home-week-title">
            <div className="home-week-head">
              <h2 id="home-week-title">השבוע שלך</h2>
              <p>
                {weekShiftCount === 0 ? (
                  'אין משמרות משובצות'
                ) : weekShiftCount === 1 ? (
                  'משמרת אחת משובצת'
                ) : (
                  <>
                    <b className="ys-num">{weekShiftCount}</b> משמרות משובצות
                  </>
                )}
              </p>
            </div>
            <ol className="home-week-days">
              {weekDays.map((d) => (
                <li
                  key={d.date}
                  data-today={d.today || undefined}
                  data-past={d.past || undefined}
                  data-shift={d.shift || undefined}
                >
                  <span>{d.letter}</span>
                  <strong className="ys-num">{d.day}</strong>
                  <i aria-hidden="true" />
                  <span className="ys-visually-hidden">{d.shift ? 'יש משמרת' : 'אין משמרת'}</span>
                </li>
              ))}
            </ol>
            <dl className="home-week-facts">
              <div>
                <dt>שעות שאושרו השבוע</dt>
                <dd className="ys-num" dir="ltr">
                  {hoursMinutes(data.confirmedSeconds)}
                </dd>
              </div>
              {data.reviewCount > 0 && (
                <div className="is-attention">
                  <dt>ממתינות לבדיקה</dt>
                  <dd className="ys-num">{data.reviewCount}</dd>
                </div>
              )}
            </dl>
          </section>
        </>
      )}
      <NotificationPrompt />
      {nextSteps?.availabilitySubmitted === false && (
        <Link href={nextSteps.availabilityHref} className="home-nudge">
          <span className="home-tile home-tile--yellow" aria-hidden="true">
            <AvailabilityGlyph size={20} variant="solid" />
          </span>
          <span className="home-nudge-text">
            <strong>זמינות לשבוע הבא טרם הוגשה</strong>
            <small>הגישו עכשיו כדי שישבצו אתכם</small>
          </span>
          <span className="home-nudge-action">להגשה</span>
        </Link>
      )}
    </div>
  );
}
