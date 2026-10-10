'use client';

import { WeekNavigator } from './WeekNavigator';
import React, { useEffect, useState } from 'react';
import { orderWorkerShifts } from './shift-order';
import { useRouter } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import type { WeeklyScheduleDetails, ScheduledShiftWithDetails } from '@yellowshifts/types';
import { EmptyState, StatusBadge } from '@yellowshifts/ui';
import {
  AvailabilityGlyph,
  MoonGlyph,
  RosterGlyph,
  SunGlyph,
  TeamGlyph,
} from '@yellowshifts/icons';
import { DayBar, minutesOfWallTime } from './WorkerVisuals';

interface WorkerScheduleViewProps {
  stationId: string;
  timezone: string;
  initialNow: number;
  stationName: string;
  workerUserId: string;
  selectedWeekStart: string; // YYYY-MM-DD (Sunday)
  schedule: WeeklyScheduleDetails | null;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '') || '?';
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.slice(0, 10).split('-');
  const y = parts[0] ?? '';
  const m = parts[1] ?? '';
  const d = parts[2] ?? '';
  return `${d}/${m}/${y}`;
}

function getHebrewDayName(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  return `יום ${HEBREW_DAYS[d.getUTCDay()]}`;
}

function timeOf(value: string): string {
  return value.includes('T') ? (value.split('T')[1]?.slice(0, 5) ?? '') : value.slice(11, 16);
}

function isShiftOvernight(start: string, end: string): boolean {
  if (!start || !end) return false;
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  return eh < sh || (eh === sh && em <= sm);
}

export function WorkerScheduleView({
  stationId,
  timezone,
  initialNow,
  stationName: _stationName,
  workerUserId,
  selectedWeekStart,
  schedule,
}: WorkerScheduleViewProps) {
  const router = useRouter();
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const weekEnd = addDays(selectedWeekStart, 6);

  const navigateWeek = (offsetDays: number) => {
    const nextWeek = addDays(selectedWeekStart, offsetDays);
    router.push(`/?week=${nextWeek}&stationId=${stationId}`);
  };

  // Filter only shifts where this worker is assigned
  const myShifts: ScheduledShiftWithDetails[] = (schedule?.shifts ?? [])
    .filter((s) => s.assignments.some((a) => a.user.id === workerUserId))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const ordered = orderWorkerShifts(myShifts, timezone, now);
  const remaining = ordered.filter((item) => !item.past).length;

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(selectedWeekStart, i);
    return {
      date,
      letter: DAY_LETTERS[i],
      day: Number(date.slice(8, 10)),
      shift: myShifts.some((s) => s.shiftDate.slice(0, 10) === date),
      today: date === today,
      past: date < today,
    };
  });

  const roleLabel = (role: string) =>
    role === 'ADMIN' ? 'מנהל תחנה' : role === 'SHIFT_MANAGER' ? 'אחמ״ש' : 'עובד';

  return (
    <div className="worker-details">
      <WeekNavigator
        start={selectedWeekStart}
        end={weekEnd}
        onNavigate={navigateWeek}
        days={
          <ol className="worker-week-strip" aria-label="ימי השבוע">
            {strip.map((d) => (
              <li
                key={d.date}
                data-today={d.today || undefined}
                data-past={d.past || undefined}
                data-shift={d.shift || undefined}
              >
                {d.shift ? (
                  <a href={`#shift-${d.date}`}>
                    <span>{d.letter}</span>
                    <strong className="ys-num">{d.day}</strong>
                    <i aria-hidden="true" />
                    <span className="ys-visually-hidden">יש משמרת</span>
                  </a>
                ) : (
                  <span>
                    <span>{d.letter}</span>
                    <strong className="ys-num">{d.day}</strong>
                    <i aria-hidden="true" />
                  </span>
                )}
              </li>
            ))}
          </ol>
        }
      >
        {schedule?.status === 'PUBLISHED' ? (
          <StatusBadge status="published" label="סידור העבודה פורסם" />
        ) : (
          <StatusBadge status="draft" label="טרם פורסם סידור לשבוע זה" />
        )}
      </WeekNavigator>

      {myShifts.length === 0 ? (
        <div className="ys-card">
          <EmptyState
            icon={<RosterGlyph size={26} variant="duo" />}
            title="אין משמרות משובצות עבורך בשבוע זה"
            description="יתכן שטרם שובצת למשמרות בשבוע זה, או שסידור העבודה השבועי נמצא עדיין בשלבי עריכה ולא פורסם רשמית."
            action={
              <Link
                href={`/availability?week=${selectedWeekStart}&stationId=${stationId}`}
                className="ys-button ys-button--primary"
              >
                <AvailabilityGlyph size={18} />
                <span>הגשת זמינות לשבוע זה</span>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="worker-shift-list">
          <p className="worker-shift-summary">
            {remaining === 1 ? (
              <>
                נותרה לך <strong className="ys-num">משמרת אחת</strong> השבוע
              </>
            ) : remaining > 0 ? (
              <>
                נותרו לך <strong className="ys-num">{remaining}</strong> משמרות השבוע
              </>
            ) : (
              <>כל המשמרות המתוכננות לשבוע הזה כבר הסתיימו</>
            )}
          </p>

          {ordered
            .filter((item) => !item.past)
            .map(({ shift }) => {
              const sTime = timeOf(shift.startAt);
              const eTime = timeOf(shift.endAt);
              const overnight = isShiftOvernight(sTime, eTime);

              // Coworkers on this shift (excluding caller)
              const coworkers = shift.assignments.filter((a) => a.user.id !== workerUserId);

              return (
                <article
                  key={shift.id}
                  id={`shift-${shift.shiftDate.slice(0, 10)}`}
                  className="worker-shift-card"
                  data-today={shift.shiftDate.slice(0, 10) === today || undefined}
                >
                  <header className="worker-shift-heading">
                    <div className="worker-card-date-tile">
                      <span>{getHebrewDayName(shift.shiftDate)}</span>
                      <strong className="ys-num">{shift.shiftDate.slice(8, 10)}</strong>
                    </div>
                    <div className="worker-shift-identity">
                      <h3>{shift.templateName || 'משמרת'}</h3>
                      <time className="ys-num" dateTime={shift.shiftDate}>
                        {shift.shiftDate.slice(0, 10) === today && (
                          <span className="worker-shift-today">היום</span>
                        )}
                        {formatDateDisplay(shift.shiftDate)}
                      </time>
                    </div>
                    <span className="worker-shift-period" data-period={overnight ? 'night' : 'day'}>
                      {overnight ? (
                        <MoonGlyph size={14} variant="duo" />
                      ) : (
                        <SunGlyph size={14} variant="duo" />
                      )}
                      {overnight ? 'לילה' : 'יום'}
                    </span>
                  </header>
                  <div className="worker-shift-tear" aria-hidden="true" />
                  <div className="worker-shift-body">
                    <div className="worker-shift-time">
                      <strong className="ys-num" dir="ltr">
                        {sTime} <span>–</span> {eTime}
                      </strong>
                      {overnight && <span className="worker-shift-overnight">עד למחרת</span>}
                    </div>
                    <DayBar start={minutesOfWallTime(sTime)} end={minutesOfWallTime(eTime)} />

                    {shift.notes && (
                      <p className="worker-shift-notes">
                        <strong>הערות למשמרת:</strong> {shift.notes}
                      </p>
                    )}

                    <div className="worker-shift-team">
                      <p className="worker-shift-team-title">
                        <TeamGlyph size={16} variant="duo" />
                        <span>צוות נוסף במשמרת ({coworkers.length}):</span>
                      </p>
                      {coworkers.length === 0 ? (
                        <p className="worker-shift-team-empty">
                          אין עובדים נוספים משובצים במשמרת זו
                        </p>
                      ) : (
                        <ul className="worker-shift-team-list">
                          {coworkers.map((c) => (
                            <li key={c.id}>
                              <span className="worker-shift-team-avatar" aria-hidden="true">
                                {initials(c.user.fullName || '')}
                              </span>
                              <span className="worker-shift-team-name">{c.user.fullName}</span>
                              <span className="worker-shift-team-role">
                                {roleLabel(c.membership.role)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

          {ordered.length > remaining && (
            <section className="worker-past" aria-labelledby="worker-past-title">
              <div className="worker-past-heading">
                <h3 id="worker-past-title">משמרות שעברו</h3>
                <span>{ordered.length - remaining} משמרות · לפי שעת הסיום המתוכננת</span>
              </div>
              <ul className="worker-past-list">
                {ordered
                  .filter((item) => item.past)
                  .map(({ shift }) => {
                    const sTime = timeOf(shift.startAt);
                    const eTime = timeOf(shift.endAt);
                    const coworkers = shift.assignments.filter(
                      (a) => a.user.id !== workerUserId
                    ).length;
                    return (
                      <li key={shift.id}>
                        <span className="worker-past-date">
                          <span>{getHebrewDayName(shift.shiftDate).replace(/^יום /, '')}</span>
                          <time className="ys-num" dateTime={shift.shiftDate}>
                            {formatDateDisplay(shift.shiftDate).slice(0, 5)}
                          </time>
                        </span>
                        <span className="worker-past-main">
                          <strong>{shift.templateName || 'משמרת'}</strong>
                          <span className="ys-num" dir="ltr">
                            {sTime}–{eTime}
                          </span>
                          {shift.notes && (
                            <span className="worker-past-note">הערות למשמרת: {shift.notes}</span>
                          )}
                          <span className="worker-past-team">צוות נוסף במשמרת ({coworkers})</span>
                        </span>
                        <StatusBadge status="completed" label="עברה" />
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
