'use client';
import { isAvailabilitySubmitted } from '@yellowshifts/database/public';

import { WeekNavigator } from './WeekNavigator';
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  WeeklyAvailabilityWithEntries,
  AvailabilityType,
  SaveAvailabilityEntryInput,
} from '@yellowshifts/types';
import { saveWorkerAvailabilityAction } from '../actions/availability';
import { Alert, Button, Badge, StatusBadge } from '@yellowshifts/ui';
import {
  CheckIcon,
  SendIcon,
  WarningIcon,
  SuccessIcon,
  CloseIcon,
  MoonIcon,
  SunIcon,
} from '@yellowshifts/icons';

interface WeeklyAvailabilityFormProps {
  stationId: string;
  stationMembershipId: string;
  weekStartDate: string; // YYYY-MM-DD (Sunday)
  initialData: WeeklyAvailabilityWithEntries | null;
  isHistoricalWeek: boolean;
  todayStr?: string;
  currentWeekStart?: string;
}

const HEBREW_DAYS = [
  { index: 0, name: 'יום ראשון', short: 'ראשון' },
  { index: 1, name: 'יום שני', short: 'שני' },
  { index: 2, name: 'יום שלישי', short: 'שלישי' },
  { index: 3, name: 'יום רביעי', short: 'רביעי' },
  { index: 4, name: 'יום חמישי', short: 'חמישי' },
  { index: 5, name: 'יום שישי', short: 'שישי' },
  { index: 6, name: 'יום שבת', short: 'שבת' },
];

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

interface DayState {
  date: string;
  availabilityType: AvailabilityType;
  startTime: string;
  endTime: string;
  notes: string;
}

function isOvernight(start: string, end: string): boolean {
  if (!start || !end) return false;
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  return eh < sh || (eh === sh && em <= sm);
}

function buildDayStates(
  weekStartDate: string,
  initialData: WeeklyAvailabilityWithEntries | null
): DayState[] {
  return HEBREW_DAYS.map((day) => {
    const dateStr = addDays(weekStartDate, day.index);
    const existing = initialData?.entries.find((e) => e.date === dateStr);

    if (existing) {
      return {
        date: dateStr,
        availabilityType: existing.availabilityType,
        startTime: existing.startTime ? existing.startTime.slice(0, 5) : '07:00',
        endTime: existing.endTime ? existing.endTime.slice(0, 5) : '15:00',
        notes: existing.notes || '',
      };
    }

    // Default: available all day
    return {
      date: dateStr,
      availabilityType: 'ALL_DAY_AVAILABLE',
      startTime: '07:00',
      endTime: '15:00',
      notes: '',
    };
  });
}

export function WeeklyAvailabilityForm({
  stationId,
  stationMembershipId,
  weekStartDate,
  initialData,
  isHistoricalWeek,
  todayStr,
  currentWeekStart,
}: WeeklyAvailabilityFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const activeToday =
    todayStr || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  const activeCurrentWeekStart = currentWeekStart || weekStartDate;
  const maxWeekStart = addDays(activeCurrentWeekStart, 14);

  // Navigation button boundaries:
  // Cannot navigate to past weeks older than current week
  // Cannot navigate further than 2 weeks ahead
  const isPrevDisabled = isPending || weekStartDate <= activeCurrentWeekStart;
  const isNextDisabled = isPending || weekStartDate >= maxWeekStart;

  // Initialize day states from initialData or defaults
  const [dayStates, setDayStates] = useState<DayState[]>(() =>
    buildDayStates(weekStartDate, initialData)
  );

  const [generalNotes, setGeneralNotes] = useState(initialData?.week.notes || '');

  // Synchronize state whenever weekStartDate or initialData changes (prevents stale dates on navigation)
  React.useEffect(() => {
    setDayStates(buildDayStates(weekStartDate, initialData));
    setGeneralNotes(initialData?.week.notes || '');
    setFeedback(null);
  }, [weekStartDate, initialData]);

  const weekEnd = addDays(weekStartDate, 6);
  const isClosedWeek = isHistoricalWeek || weekStartDate <= activeCurrentWeekStart;
  const allDaysPast = isClosedWeek || dayStates.every((d) => d.date < activeToday);

  const navigateWeek = (offsetDays: number) => {
    const nextWeek = addDays(weekStartDate, offsetDays);
    router.push(`/availability?week=${nextWeek}&stationId=${stationId}`);
  };

  const handleTypeChange = (dayIndex: number, type: AvailabilityType) => {
    if (isClosedWeek) return;
    setDayStates((prev) => {
      const copy = [...prev];
      const current = copy[dayIndex];
      if (!current || current.date < activeToday) return prev;
      copy[dayIndex] = { ...current, availabilityType: type };
      return copy;
    });
  };

  const handleTimeChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    if (isClosedWeek) return;
    setDayStates((prev) => {
      const copy = [...prev];
      const current = copy[dayIndex];
      if (!current || current.date < activeToday) return prev;
      copy[dayIndex] = { ...current, [field]: value };
      return copy;
    });
  };

  const handleNotesChange = (dayIndex: number, value: string) => {
    if (isClosedWeek) return;
    setDayStates((prev) => {
      const copy = [...prev];
      const current = copy[dayIndex];
      if (!current || current.date < activeToday) return prev;
      copy[dayIndex] = { ...current, notes: value };
      return copy;
    });
  };

  const handleSave = () => {
    setFeedback(null);

    if (isClosedWeek) {
      setFeedback({
        type: 'error',
        text: 'לא ניתן לשמור זמינות עבור השבוע הנוכחי או שבועות שעברו. יש לבחור את השבוע הבא.',
      });
      return;
    }

    // Validate any TIME_WINDOW where start == end for active days
    for (let i = 0; i < dayStates.length; i++) {
      const d = dayStates[i];
      if (!d) continue;
      if (d.availabilityType === 'TIME_WINDOW' && d.startTime === d.endTime) {
        setFeedback({
          type: 'error',
          text: `ביום ${HEBREW_DAYS[i]?.name}: שעת הסיום חייבת להיות שונה משעת ההתחלה`,
        });
        return;
      }
    }

    startTransition(async () => {
      const entries: SaveAvailabilityEntryInput[] = dayStates.map((d) => ({
        date: d.date,
        availabilityType: d.availabilityType,
        startTime: d.availabilityType === 'TIME_WINDOW' ? d.startTime : null,
        endTime: d.availabilityType === 'TIME_WINDOW' ? d.endTime : null,
        notes: d.notes.trim() || null,
      }));

      const res = await saveWorkerAvailabilityAction({
        stationId,
        stationMembershipId,
        weekStartDate,
        notes: generalNotes.trim() || undefined,
        entries,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          text: 'הזמינות השבועית נשמרה בהצלחה! מנהלי התחנה יוכלו לראות אותה בעת סידור המשמרות.',
        });
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          text: res.error || 'שגיאה בשמירת הזמינות',
        });
      }
    });
  };

  const submitted = isAvailabilitySubmitted(initialData);
  const notesDisabled = isHistoricalWeek || allDaysPast || isPending;

  return (
    <div className="worker-details worker-availability">
      <WeekNavigator
        start={weekStartDate}
        end={weekEnd}
        onNavigate={navigateWeek}
        previousDisabled={isPrevDisabled}
        nextDisabled={isNextDisabled}
        label={
          weekStartDate < activeCurrentWeekStart
            ? 'שבוע שעבר (היסטורי)'
            : weekStartDate === activeCurrentWeekStart
              ? 'השבוע הנוכחי (סגור לעריכה)'
              : weekStartDate === addDays(activeCurrentWeekStart, 7)
                ? 'השבוע הבא (פתוח להגשה)'
                : weekStartDate === addDays(activeCurrentWeekStart, 14)
                  ? 'בעוד שבועיים (פתוח להגשה)'
                  : 'השבוע הנבחר'
        }
      >
        {submitted ? (
          <StatusBadge status="approved" label="הוגשה זמינות לשבוע זה" />
        ) : (
          <StatusBadge
            status="pending"
            label={initialData ? 'נשמרה זמינות חלקית · יש להשלים ולשלוח' : 'טרם הוגשה זמינות'}
          />
        )}
      </WeekNavigator>

      {feedback && (
        <div
          className={`worker-feedback worker-feedback--${feedback.type}`}
          role={feedback.type === 'success' ? 'status' : 'alert'}
        >
          {feedback.type === 'success' ? (
            <SuccessIcon size={20} aria-hidden="true" />
          ) : (
            <WarningIcon size={20} aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="סגירת ההודעה">
            <CloseIcon size={18} />
          </button>
        </div>
      )}

      {isClosedWeek && (
        <Alert variant="info">
          {weekStartDate < activeCurrentWeekStart
            ? 'שבוע זה שייך לעבר. לא ניתן להגיש או לעדכן זמינות עבור שבועות שעברו.'
            : 'השבוע הנוכחי כבר החל ולא ניתן לשנות את הזמינות עבורו. הגשת זמינות פתוחה עבור השבוע הבא ואילך בלבד.'}
        </Alert>
      )}

      <div className="worker-availability-days">
        {HEBREW_DAYS.map((day) => {
          const state = dayStates[day.index];
          if (!state) return null;

          const isPastDay = state.date < activeToday;
          const isToday = state.date === activeToday;
          const isDayDisabled = isClosedWeek || isPastDay;

          const overnightFlag =
            state.availabilityType === 'TIME_WINDOW' && isOvernight(state.startTime, state.endTime);
          const fieldId = `availability-${state.date}`;

          return (
            <article
              className="worker-availability-card"
              key={day.index}
              data-disabled={isDayDisabled}
              data-type={state.availabilityType}
              aria-labelledby={`${fieldId}-title`}
            >
              <header className="worker-availability-heading">
                <div className="worker-availability-day">
                  <h3 id={`${fieldId}-title`}>
                    {day.name}
                    <span className="ys-num">{formatDateDisplay(state.date)}</span>
                  </h3>
                  {isPastDay ? (
                    <Badge variant="neutral">עבר</Badge>
                  ) : isToday ? (
                    <Badge variant="brandYellow">היום</Badge>
                  ) : isClosedWeek ? (
                    <Badge variant="neutral">סגור להגשה</Badge>
                  ) : null}
                </div>

                <div
                  className="ys-segmented worker-availability-options"
                  role="group"
                  aria-label={`זמינות ל${day.name}`}
                >
                  <button
                    type="button"
                    disabled={isDayDisabled || isPending}
                    onClick={() => handleTypeChange(day.index, 'ALL_DAY_AVAILABLE')}
                    aria-pressed={state.availabilityType === 'ALL_DAY_AVAILABLE'}
                    data-option="available"
                  >
                    זמין כל היום
                  </button>
                  <button
                    type="button"
                    disabled={isDayDisabled || isPending}
                    onClick={() => handleTypeChange(day.index, 'ALL_DAY_UNAVAILABLE')}
                    aria-pressed={state.availabilityType === 'ALL_DAY_UNAVAILABLE'}
                    data-option="unavailable"
                  >
                    לא זמין
                  </button>
                  <button
                    type="button"
                    disabled={isDayDisabled || isPending}
                    onClick={() => handleTypeChange(day.index, 'TIME_WINDOW')}
                    aria-pressed={state.availabilityType === 'TIME_WINDOW'}
                    data-option="window"
                  >
                    חלון שעות
                  </button>
                </div>
              </header>

              <div className="worker-availability-body">
                {isDayDisabled ? (
                  <p className="worker-availability-locked">
                    <span>
                      {isPastDay
                        ? 'יום זה חלף - לא ניתן לעדכן זמינות.'
                        : 'לא ניתן להגיש עבור שבוע זה.'}
                    </span>
                    {state.availabilityType === 'ALL_DAY_AVAILABLE' && (
                      <strong>(נקבע: זמין כל היום)</strong>
                    )}
                    {state.availabilityType === 'ALL_DAY_UNAVAILABLE' && (
                      <strong>(נקבע: לא זמין)</strong>
                    )}
                    {state.availabilityType === 'TIME_WINDOW' && (
                      <strong className="ys-num">
                        (נקבע: {state.startTime} - {state.endTime})
                      </strong>
                    )}
                  </p>
                ) : (
                  <>
                    {state.availabilityType === 'ALL_DAY_AVAILABLE' && (
                      <p className="worker-availability-summary">זמין לכל משמרת ביום הזה.</p>
                    )}

                    {state.availabilityType === 'ALL_DAY_UNAVAILABLE' && (
                      <div className="worker-availability-fields">
                        <p className="worker-availability-summary is-unavailable">
                          לא פנוי למשמרות ביום הזה.
                        </p>
                        <label className="ys-form-field" htmlFor={`${fieldId}-note`}>
                          <span className="ys-label">סיבה או הערה למנהל (אופציונלי)</span>
                          <input
                            id={`${fieldId}-note`}
                            type="text"
                            disabled={isPending}
                            placeholder="מבחן, לימודים..."
                            value={state.notes}
                            onChange={(e) => handleNotesChange(day.index, e.target.value)}
                          />
                        </label>
                      </div>
                    )}

                    {state.availabilityType === 'TIME_WINDOW' && (
                      <div className="worker-availability-fields">
                        <div className="worker-availability-window">
                          <label className="ys-form-field" htmlFor={`${fieldId}-start`}>
                            <span className="ys-label">משעה</span>
                            <input
                              id={`${fieldId}-start`}
                              type="time"
                              disabled={isPending}
                              value={state.startTime}
                              onChange={(e) =>
                                handleTimeChange(day.index, 'startTime', e.target.value)
                              }
                            />
                          </label>
                          <label className="ys-form-field" htmlFor={`${fieldId}-end`}>
                            <span className="ys-label">עד שעה</span>
                            <input
                              id={`${fieldId}-end`}
                              type="time"
                              disabled={isPending}
                              value={state.endTime}
                              onChange={(e) =>
                                handleTimeChange(day.index, 'endTime', e.target.value)
                              }
                            />
                          </label>
                        </div>
                        {overnightFlag ? (
                          <Badge variant="warning">
                            <MoonIcon size={13} aria-hidden="true" />
                            חלון לילה (חוצה חצות)
                          </Badge>
                        ) : (
                          <Badge variant="neutral">
                            <SunIcon size={13} aria-hidden="true" />
                            חלון יום
                          </Badge>
                        )}
                        <label className="ys-form-field" htmlFor={`${fieldId}-note`}>
                          <span className="ys-label">הערה לשעות אלו (אופציונלי)</span>
                          <input
                            id={`${fieldId}-note`}
                            type="text"
                            disabled={isPending}
                            value={state.notes}
                            onChange={(e) => handleNotesChange(day.index, e.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="ys-card worker-availability-notes">
        <label className="ys-form-field" htmlFor="availability-general-notes">
          <span className="ys-label">הערות כלליות לשבוע זה (אופציונלי)</span>
          <textarea
            id="availability-general-notes"
            rows={2}
            disabled={notesDisabled}
            placeholder={
              isHistoricalWeek || allDaysPast
                ? 'לא ניתן לערוך הערות לשבוע שעבר'
                : 'לדוגמה: מעדיף משמרות ערב / זמין לסגירות...'
            }
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
          />
        </label>
      </div>

      {!isClosedWeek && (
        <div className="worker-save-bar">
          <p>
            {submitted ? (
              <>
                עודכן לאחרונה:{' '}
                <span className="ys-num">
                  {new Date(initialData!.week.updatedAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </>
            ) : (
              'לא נשמרה זמינות עדיין לשבוע זה'
            )}
          </p>
          <Button
            isLoading={isPending}
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={isPending}
            rightIcon={submitted ? <CheckIcon size={18} /> : <SendIcon size={18} />}
          >
            {submitted ? 'עדכון' : 'שליחה'}
          </Button>
        </div>
      )}
    </div>
  );
}
