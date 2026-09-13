'use client';

import { WeekNavigator } from './WeekNavigator';
import React from 'react';
import { useRouter } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import type { WeeklyScheduleDetails, ScheduledShiftWithDetails } from '@yellowshifts/types';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@yellowshifts/ui';
import {
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  MoonIcon,
  SunIcon,
  BriefcaseIcon,
} from '@yellowshifts/icons';

interface WorkerScheduleViewProps {
  stationId: string;
  stationName: string;
  workerUserId: string;
  selectedWeekStart: string; // YYYY-MM-DD (Sunday)
  schedule: WeeklyScheduleDetails | null;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

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

function isShiftOvernight(start: string, end: string): boolean {
  if (!start || !end) return false;
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  return eh < sh || (eh === sh && em <= sm);
}

export function WorkerScheduleView({
  stationId,
  stationName: _stationName,
  workerUserId,
  selectedWeekStart,
  schedule,
}: WorkerScheduleViewProps) {
  const router = useRouter();
  const weekEnd = addDays(selectedWeekStart, 6);

  const navigateWeek = (offsetDays: number) => {
    const nextWeek = addDays(selectedWeekStart, offsetDays);
    router.push(`/?week=${nextWeek}&stationId=${stationId}`);
  };

  // Filter only shifts where this worker is assigned
  const myShifts: ScheduledShiftWithDetails[] = (schedule?.shifts ?? [])
    .filter((s) => s.assignments.some((a) => a.user.id === workerUserId))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <div
      className="worker-details"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <WeekNavigator start={selectedWeekStart} end={weekEnd} onNavigate={navigateWeek}>
        {schedule?.status === 'PUBLISHED' ? (
          <Badge variant="success">סידור העבודה פורסם</Badge>
        ) : (
          <Badge variant="neutral">טרם פורסם סידור לשבוע זה</Badge>
        )}
      </WeekNavigator>

      {/* Shifts Content */}
      {myShifts.length === 0 ? (
        <Card
          style={{
            padding: 0,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <CardContent style={{ textAlign: 'center', padding: '28px 20px' }}>
            <BriefcaseIcon size={48} style={{ color: '#9CA3AF', margin: '0 auto 16px' }} />
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#111827',
                marginBottom: '8px',
              }}
            >
              אין משמרות משובצות עבורך בשבוע זה
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#4B5563',
                maxWidth: '420px',
                margin: '0 auto 20px',
                lineHeight: '1.5',
              }}
            >
              יתכן שטרם שובצת למשמרות בשבוע זה, או שסידור העבודה השבועי נמצא עדיין בשלבי עריכה ולא
              פורסם רשמית.
            </p>
            <Link
              href={`/availability?week=${selectedWeekStart}&stationId=${stationId}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--ys-color-brand-yellow)',
                color: '#111827',
                fontWeight: 700,
                fontSize: '0.875rem',
                padding: '8px 16px',
                borderRadius: '6px',
                textDecoration: 'none',
              }}
            >
              <CalendarIcon size={16} />
              <span>הגשת זמינות לשבוע זה</span>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '0.875rem', color: '#4B5563', fontWeight: 600 }}>
            משובץ ל-<strong>{myShifts.length}</strong> משמרות בשבוע זה:
          </div>

          {myShifts.map((shift) => {
            const sTime = shift.startAt.includes('T')
              ? (shift.startAt.split('T')[1]?.slice(0, 5) ?? '')
              : shift.startAt.slice(11, 16);
            const eTime = shift.endAt.includes('T')
              ? (shift.endAt.split('T')[1]?.slice(0, 5) ?? '')
              : shift.endAt.slice(11, 16);
            const overnight = isShiftOvernight(sTime, eTime);

            // Coworkers on this shift (excluding caller)
            const coworkers = shift.assignments.filter((a) => a.user.id !== workerUserId);

            return (
              <Card
                key={shift.id}
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                <CardHeader
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderBottom: '1px solid #F3F4F6',
                    padding: '12px 18px',
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
                        backgroundColor: 'var(--ys-color-brand-yellow)',
                        color: '#111827',
                        fontWeight: 800,
                        fontSize: '0.8125rem',
                        padding: '3px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {getHebrewDayName(shift.shiftDate)}
                    </span>
                    <CardTitle
                      style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#111827' }}
                    >
                      {formatDateDisplay(shift.shiftDate)} • {shift.templateName || 'משמרת'}
                    </CardTitle>
                  </div>

                  <div>
                    {overnight ? (
                      <Badge
                        variant="warning"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <MoonIcon size={12} />
                        <span>לילה (מסתיים למחרת)</span>
                      </Badge>
                    ) : (
                      <Badge
                        variant="neutral"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <SunIcon size={12} />
                        <span>יום</span>
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent
                  style={{
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Hours */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ClockIcon size={18} style={{ color: 'var(--ys-color-brand-yellow)' }} />
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                      {sTime} — {eTime}
                    </span>
                    {overnight && (
                      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                        (מסתיים למחרת ב-{eTime})
                      </span>
                    )}
                  </div>

                  {/* Notes */}
                  {shift.notes && (
                    <div
                      style={{
                        backgroundColor: '#F9FAFB',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        color: '#374151',
                        border: '1px solid #E5E7EB',
                      }}
                    >
                      <strong>הערות למשמרת:</strong> {shift.notes}
                    </div>
                  )}

                  {/* Coworkers */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '10px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8125rem',
                        color: '#6B7280',
                        marginBottom: '8px',
                      }}
                    >
                      <UsersIcon size={14} />
                      <span>צוות נוסף במשמרת ({coworkers.length}):</span>
                    </div>

                    {coworkers.length === 0 ? (
                      <span style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>
                        אין עובדים נוספים משובצים במשמרת זו
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {coworkers.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              backgroundColor: '#F3F4F6',
                              border: '1px solid #E5E7EB',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '0.8125rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#111827' }}>
                              {c.user.fullName}
                            </span>
                            <Badge
                              variant="neutral"
                              style={{ fontSize: '0.625rem', padding: '1px 5px' }}
                            >
                              {c.membership.role === 'ADMIN'
                                ? 'מנהל תחנה'
                                : c.membership.role === 'SHIFT_MANAGER'
                                  ? 'אחמ״ש'
                                  : 'עובד'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
