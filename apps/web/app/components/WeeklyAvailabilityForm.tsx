'use client';

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
  CalendarIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckIcon,
  WarningIcon,
  SuccessIcon,
  CloseIcon,
  MoonIcon,
  SunIcon,
} from '@yellowshifts/icons';

interface WeeklyAvailabilityFormProps {
  stationId: string;
  stationMembershipId: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  initialData: WeeklyAvailabilityWithEntries | null;
  isHistoricalWeek: boolean;
  todayStr?: string;
  currentWeekStart?: string;
}

const HEBREW_DAYS = [
  { index: 0, name: 'יום שני', short: 'שני' },
  { index: 1, name: 'יום שלישי', short: 'שלישי' },
  { index: 2, name: 'יום רביעי', short: 'רביעי' },
  { index: 3, name: 'יום חמישי', short: 'חמישי' },
  { index: 4, name: 'יום שישי', short: 'שישי' },
  { index: 5, name: 'יום שבת', short: 'שבת' },
  { index: 6, name: 'יום ראשון', short: 'ראשון' },
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
  const allDaysPast = dayStates.every((d) => isHistoricalWeek || d.date < activeToday);

  const navigateWeek = (offsetDays: number) => {
    const nextWeek = addDays(weekStartDate, offsetDays);
    router.push(`/availability?week=${nextWeek}&stationId=${stationId}`);
  };

  const handleTypeChange = (dayIndex: number, type: AvailabilityType) => {
    setDayStates((prev) => {
      const copy = [...prev];
      const current = copy[dayIndex];
      if (!current || isHistoricalWeek || current.date < activeToday) return prev;
      copy[dayIndex] = { ...current, availabilityType: type };
      return copy;
    });
  };

  const handleTimeChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setDayStates((prev) => {
      const copy = [...prev];
      const current = copy[dayIndex];
      if (!current || isHistoricalWeek || current.date < activeToday) return prev;
      copy[dayIndex] = { ...current, [field]: value };
      return copy;
    });
  };

  const handleNotesChange = (dayIndex: number, value: string) => {
    setDayStates((prev) => {
      const copy = [...prev];
      const current = copy[dayIndex];
      if (!current || isHistoricalWeek || current.date < activeToday) return prev;
      copy[dayIndex] = { ...current, notes: value };
      return copy;
    });
  };

  const handleSave = () => {
    setFeedback(null);

    // Validate any TIME_WINDOW where start == end for active (non-past) days
    for (let i = 0; i < dayStates.length; i++) {
      const d = dayStates[i];
      if (!d) continue;
      const isPast = isHistoricalWeek || d.date < activeToday;
      if (!isPast && d.availabilityType === 'TIME_WINDOW' && d.startTime === d.endTime) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Week Navigator Card */}
      <Card
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <CardContent style={{ padding: '16px 20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigateWeek(-7)}
                disabled={isPrevDisabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isPrevDisabled ? 0.5 : 1,
                  cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronRightIcon size={16} />
                <span>שבוע קודם</span>
              </Button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#F3F4F6',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                }}
              >
                <CalendarIcon size={16} style={{ color: 'var(--ys-color-brand-yellow)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>
                  שבוע: {formatDateDisplay(weekStartDate)} — {formatDateDisplay(weekEnd)}
                </span>
                {weekStartDate === activeCurrentWeekStart && (
                  <Badge variant="neutral" style={{ fontSize: '0.75rem', padding: '1px 6px' }}>
                    שבוע נוכחי
                  </Badge>
                )}
                {weekStartDate === addDays(activeCurrentWeekStart, 7) && (
                  <Badge variant="brandYellow" style={{ fontSize: '0.75rem', padding: '1px 6px' }}>
                    שבוע הבא
                  </Badge>
                )}
                {weekStartDate === addDays(activeCurrentWeekStart, 14) && (
                  <Badge variant="neutral" style={{ fontSize: '0.75rem', padding: '1px 6px' }}>
                    בעוד שבועיים
                  </Badge>
                )}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigateWeek(7)}
                disabled={isNextDisabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isNextDisabled ? 0.5 : 1,
                  cursor: isNextDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                <span>שבוע הבא</span>
                <ChevronLeftIcon size={16} />
              </Button>
            </div>

            <div>
              {initialData ? (
                <Badge
                  variant="success"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <CheckIcon size={12} />
                  <span>הוגשה זמינות לשבוע זה</span>
                </Badge>
              ) : (
                <Badge variant="warning">טרם הוגשה זמינות</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Historical Week / Passed Days Notice */}
      {(isHistoricalWeek || allDaysPast) && (
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
          שבוע זה שייך לעבר. לא ניתן להגיש או לעדכן זמינות עבור ימים או שבועות שעברו.
        </div>
      )}

      {/* 7 Days List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {HEBREW_DAYS.map((day) => {
          const state = dayStates[day.index];
          if (!state) return null;

          const isPastDay = isHistoricalWeek || state.date < activeToday;
          const isToday = state.date === activeToday;

          const overnightFlag =
            state.availabilityType === 'TIME_WINDOW' && isOvernight(state.startTime, state.endTime);

          return (
            <Card
              key={day.index}
              style={{
                backgroundColor: '#FFFFFF',
                border: isPastDay
                  ? '1px solid #E5E7EB'
                  : state.availabilityType === 'ALL_DAY_UNAVAILABLE'
                    ? '1px solid #FCA5A5'
                    : state.availabilityType === 'TIME_WINDOW'
                      ? '1px solid #FCD34D'
                      : '1px solid #E5E7EB',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                opacity: isPastDay ? 0.75 : 1,
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
                  <span
                    style={{
                      backgroundColor: isPastDay ? '#E5E7EB' : 'var(--ys-color-brand-yellow)',
                      color: isPastDay ? '#6B7280' : '#111827',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    {day.short}
                  </span>
                  <CardTitle
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 700,
                      margin: 0,
                      color: isPastDay ? '#6B7280' : '#111827',
                    }}
                  >
                    {day.name} • {formatDateDisplay(state.date)}
                  </CardTitle>
                  {isPastDay && (
                    <Badge variant="neutral" style={{ fontSize: '0.6875rem', padding: '1px 6px' }}>
                      עבר
                    </Badge>
                  )}
                  {isToday && (
                    <Badge
                      variant="brandYellow"
                      style={{ fontSize: '0.6875rem', padding: '1px 6px' }}
                    >
                      היום
                    </Badge>
                  )}
                </div>

                {/* Direct 1-Tap Toggles */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={isPastDay || isPending}
                    onClick={() => handleTypeChange(day.index, 'ALL_DAY_AVAILABLE')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: isPastDay ? 'not-allowed' : 'pointer',
                      opacity: isPastDay ? 0.5 : 1,
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
                    disabled={isPastDay || isPending}
                    onClick={() => handleTypeChange(day.index, 'ALL_DAY_UNAVAILABLE')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: isPastDay ? 'not-allowed' : 'pointer',
                      opacity: isPastDay ? 0.5 : 1,
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
                    disabled={isPastDay || isPending}
                    onClick={() => handleTypeChange(day.index, 'TIME_WINDOW')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: isPastDay ? 'not-allowed' : 'pointer',
                      opacity: isPastDay ? 0.5 : 1,
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
                {isPastDay ? (
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
                    <span>יום זה חלף — לא ניתן לעדכן זמינות עבור ימים שעברו.</span>
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
                        (נקבע: {state.startTime} — {state.endTime})
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
      {!isHistoricalWeek && !allDaysPast && (
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
            {initialData ? (
              <span>
                עודכן לאחרונה:{' '}
                {new Date(initialData.week.updatedAt).toLocaleTimeString('he-IL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : (
              <span>לא נשמרה זמינות עדיין לשבוע זה</span>
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '140px',
              justifyContent: 'center',
            }}
          >
            <CheckIcon size={16} />
            <span>{isPending ? 'שומר...' : 'שמור זמינות שבועית'}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
