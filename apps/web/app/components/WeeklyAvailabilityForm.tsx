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
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@yellowshifts/ui';
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

  return (
    <div
      className="worker-details"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
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
        {isAvailabilitySubmitted(initialData) ? (
          <Badge variant="success">הוגשה זמינות לשבוע זה</Badge>
        ) : (
          <Badge variant="warning">
            {initialData ? 'נשמרה זמינות חלקית · יש להשלים ולשלוח' : 'טרם הוגשה זמינות'}
          </Badge>
        )}
      </WeekNavigator>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: feedback.type === 'success' ? '1px solid #A7F3D0' : '1px solid #FECACA',
            color: feedback.type === 'success' ? '#065F46' : '#991B1B',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <SuccessIcon size={18} /> : <WarningIcon size={18} />}
            <span style={{ fontWeight: 500 }}>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {/* Historical Week / Current Closed Week Notice */}
      {isClosedWeek && (
        <div
          style={{
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '0.875rem',
            color: '#4B5563',
          }}
        >
          {weekStartDate < activeCurrentWeekStart
            ? 'שבוע זה שייך לעבר. לא ניתן להגיש או לעדכן זמינות עבור שבועות שעברו.'
            : 'השבוע הנוכחי כבר החל ולא ניתן לשנות את הזמינות עבורו. הגשת זמינות פתוחה עבור השבוע הבא ואילך בלבד.'}
        </div>
      )}

      {/* 7 Days List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {HEBREW_DAYS.map((day) => {
          const state = dayStates[day.index];
          if (!state) return null;

          const isPastDay = state.date < activeToday;
          const isToday = state.date === activeToday;
          const isDayDisabled = isClosedWeek || isPastDay;

          const overnightFlag =
            state.availabilityType === 'TIME_WINDOW' && isOvernight(state.startTime, state.endTime);

          return (
            <Card
              key={day.index}
              style={{
                padding: 0,
                overflow: 'hidden',
                backgroundColor: '#FFFFFF',
                border: isDayDisabled
                  ? '1px solid #E5E7EB'
                  : state.availabilityType === 'ALL_DAY_UNAVAILABLE'
                    ? '1px solid #FCA5A5'
                    : state.availabilityType === 'TIME_WINDOW'
                      ? '1px solid #FCD34D'
                      : '1px solid #E5E7EB',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                opacity: isDayDisabled ? 0.75 : 1,
              }}
            >
              <CardHeader
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid #F3F4F6',
                  backgroundColor: '#F9FAFB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CardTitle
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 700,
                      margin: 0,
                      color: isDayDisabled ? '#6B7280' : '#111827',
                    }}
                  >
                    {day.name} • {formatDateDisplay(state.date)}
                  </CardTitle>
                  {isPastDay ? (
                    <Badge variant="neutral" style={{ fontSize: '0.6875rem', padding: '1px 6px' }}>
                      עבר
                    </Badge>
                  ) : isToday ? (
                    <Badge
                      variant="brandYellow"
                      style={{ fontSize: '0.6875rem', padding: '1px 6px' }}
                    >
                      היום
                    </Badge>
                  ) : isClosedWeek ? (
                    <Badge variant="neutral" style={{ fontSize: '0.6875rem', padding: '1px 6px' }}>
                      סגור להגשה
                    </Badge>
                  ) : null}
                </div>

                {/* Direct 1-Tap Toggles */}
                <div className="worker-availability-options">
                  <button
                    type="button"
                    disabled={isDayDisabled || isPending}
                    onClick={() => handleTypeChange(day.index, 'ALL_DAY_AVAILABLE')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: isDayDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDayDisabled ? 0.5 : 1,
                      border:
                        state.availabilityType === 'ALL_DAY_AVAILABLE'
                           ? '1px solid #86EFAC'
                          : '1px solid #D1D5DB',
                      backgroundColor:
                        state.availabilityType === 'ALL_DAY_AVAILABLE' ? '#DCFCE7' : '#FFFFFF',
                      color: state.availabilityType === 'ALL_DAY_AVAILABLE' ? '#15803D' : '#4B5563',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    זמין כל היום
                  </button>

                  <button
                    type="button"
                    disabled={isDayDisabled || isPending}
                    onClick={() => handleTypeChange(day.index, 'ALL_DAY_UNAVAILABLE')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: isDayDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDayDisabled ? 0.5 : 1,
                      border:
                        state.availabilityType === 'ALL_DAY_UNAVAILABLE'
                          ? '1px solid #FCA5A5'
                          : '1px solid #D1D5DB',
                      backgroundColor:
                        state.availabilityType === 'ALL_DAY_UNAVAILABLE' ? '#FEE2E2' : '#FFFFFF',
                      color:
                        state.availabilityType === 'ALL_DAY_UNAVAILABLE' ? '#B91C1C' : '#4B5563',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    לא זמין
                  </button>

                  <button
                    type="button"
                    disabled={isDayDisabled || isPending}
                    onClick={() => handleTypeChange(day.index, 'TIME_WINDOW')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: isDayDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDayDisabled ? 0.5 : 1,
                      border:
                        state.availabilityType === 'TIME_WINDOW'
                          ? '1px solid #FCD34D'
                          : '1px solid #D1D5DB',
                      backgroundColor:
                        state.availabilityType === 'TIME_WINDOW' ? '#FEF3C7' : '#FFFFFF',
                      color: state.availabilityType === 'TIME_WINDOW' ? '#92400E' : '#4B5563',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    חלון שעות
                  </button>
                </div>
              </CardHeader>

              <CardContent style={{ padding: '14px 18px' }}>
                {isDayDisabled ? (
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: '#6B7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      {isPastDay
                        ? 'יום זה חלף - לא ניתן לעדכן זמינות.'
                        : 'לא ניתן להגיש עבור שבוע זה.'}
                    </span>
                    {state.availabilityType === 'ALL_DAY_AVAILABLE' && (
                      <span style={{ fontWeight: 600, color: '#15803D' }}>
                        (נקבע: זמין כל היום)
                      </span>
                    )}
                    {state.availabilityType === 'ALL_DAY_UNAVAILABLE' && (
                      <span style={{ fontWeight: 600, color: '#B91C1C' }}>(נקבע: לא זמין)</span>
                    )}
                    {state.availabilityType === 'TIME_WINDOW' && (
                      <span style={{ fontWeight: 600, color: '#92400E' }}>
                        (נקבע: {state.startTime} - {state.endTime})
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    {state.availabilityType === 'ALL_DAY_AVAILABLE' && (
                      <div style={{ fontSize: '0.8125rem', color: '#16A34A', fontWeight: 600 }}>
                        סימנת שאתה זמין לעבודה בכל שעה במהלך יום זה.
                      </div>
                    )}

                    {state.availabilityType === 'ALL_DAY_UNAVAILABLE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.8125rem', color: '#DC2626', fontWeight: 600 }}>
                          סימנת שאינך זמין כלל לעבודה ביום זה.
                        </div>
                        <div>
                          <input
                            type="text"
                            disabled={isPending}
                            placeholder="סיבה או הערה למנהל (אופציונלי: מבחן, לימודים...)"
                            value={state.notes}
                            onChange={(e) => handleNotesChange(day.index, e.target.value)}
                            style={{
                              width: '100%',
                              backgroundColor: '#F9FAFB',
                              border: '1px solid #D1D5DB',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.8125rem',
                              color: '#111827',
                              outline: 'none',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {state.availabilityType === 'TIME_WINDOW' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{ fontSize: '0.8125rem', color: '#4B5563', fontWeight: 500 }}
                            >
                              משעה:
                            </span>
                            <input
                              type="time"
                              disabled={isPending}
                              value={state.startTime}
                              onChange={(e) =>
                                handleTimeChange(day.index, 'startTime', e.target.value)
                              }
                              style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                padding: '6px 8px',
                                color: '#111827',
                                fontSize: '0.875rem',
                                outline: 'none',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{ fontSize: '0.8125rem', color: '#4B5563', fontWeight: 500 }}
                            >
                              עד שעה:
                            </span>
                            <input
                              type="time"
                              disabled={isPending}
                              value={state.endTime}
                              onChange={(e) =>
                                handleTimeChange(day.index, 'endTime', e.target.value)
                              }
                              style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                padding: '6px 8px',
                                color: '#111827',
                                fontSize: '0.875rem',
                                outline: 'none',
                              }}
                            />
                          </div>

                          {overnightFlag ? (
                            <Badge
                              variant="warning"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <MoonIcon size={12} />
                              <span>חלון לילה (חוצה חצות)</span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="neutral"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <SunIcon size={12} />
                              <span>חלון יום</span>
                            </Badge>
                          )}
                        </div>

                        <div>
                          <input
                            type="text"
                            disabled={isPending}
                            placeholder="הערה לשעות אלו (אופציונלי)..."
                            value={state.notes}
                            onChange={(e) => handleNotesChange(day.index, e.target.value)}
                            style={{
                              width: '100%',
                              backgroundColor: '#F9FAFB',
                              border: '1px solid #D1D5DB',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.8125rem',
                              color: '#111827',
                              outline: 'none',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* General Week Note */}
      <Card
        style={{
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <CardContent style={{ padding: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px',
            }}
          >
            הערות כלליות לשבוע זה (אופציונלי)
          </label>
          <textarea
            rows={2}
            disabled={isHistoricalWeek || allDaysPast || isPending}
            placeholder={
              isHistoricalWeek || allDaysPast
                ? 'לא ניתן לערוך הערות לשבוע שעבר'
                : 'לדוגמה: מעדיף משמרות ערב / זמין לסגירות...'
            }
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: isHistoricalWeek || allDaysPast ? '#F9FAFB' : '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.875rem',
              color: '#111827',
              resize: 'none',
              outline: 'none',
              cursor: isHistoricalWeek || allDaysPast ? 'not-allowed' : 'text',
            }}
          />
        </CardContent>
      </Card>

      {/* Bottom Save Bar */}
      {!isClosedWeek && (
        <div
          style={{
            position: 'sticky',
            bottom: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: '#6B7280' }}>
            {isAvailabilitySubmitted(initialData) ? (
              <span>
                עודכן לאחרונה:{' '}
                {new Date(initialData!.week.updatedAt).toLocaleTimeString('he-IL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : (
              <span>לא נשמרה זמינות עדיין לשבוע זה</span>
            )}
          </div>

          <Button
            isLoading={isPending}
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: '88px',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {isAvailabilitySubmitted(initialData) ? (
              <>
                <CheckIcon size={16} />
                <span>עדכון</span>
              </>
            ) : (
              <>
                <SendIcon size={16} />
                <span>שליחה</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
