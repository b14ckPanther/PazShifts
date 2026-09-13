'use client';

import React, { useState, useSyncExternalStore } from 'react';
import type {
  ScheduledShiftWithDetails,
  ShiftTemplate,
  StationMemberWithProfile,
} from '@yellowshifts/types';
import { Badge, Button } from '@yellowshifts/ui';
import {
  ClockIcon,
  PlusIcon,
  UsersIcon,
  CopyIcon,
  EditIcon,
  TrashIcon,
  MoonIcon,
  SunIcon,
  WarningIcon,
} from '@yellowshifts/icons';

interface WeeklyScheduleGridProps {
  stationId: string;
  weekStartDate: string;
  shifts: ScheduledShiftWithDetails[];
  templates: ShiftTemplate[];
  activeMembers: StationMemberWithProfile[];
  canEdit: boolean;
  isDraft: boolean;
  onOpenAddShift: (dateStr: string) => void;
  onOpenQuickAssign: (shift: ScheduledShiftWithDetails) => void;
  onOpenDuplicateShift: (shift: ScheduledShiftWithDetails) => void;
  onOpenEditShift: (shift: ScheduledShiftWithDetails) => void;
  onDeleteShift: (shiftId: string) => void;
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
  const m = parts[1] ?? '';
  const d = parts[2] ?? '';
  return `${d}/${m}`;
}

const compactQuery = '(max-width: 1023px)';
const subscribeCompact = (onChange: () => void) => {
  const query = window.matchMedia(compactQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const getCompact = () => window.matchMedia(compactQuery).matches;
export function WeeklyScheduleGrid({
  weekStartDate,
  shifts,
  canEdit,
  isDraft,
  onOpenAddShift,
  onOpenQuickAssign,
  onOpenDuplicateShift,
  onOpenEditShift,
  onDeleteShift,
}: WeeklyScheduleGridProps) {
  // Mobile active day index (0 = Sunday)
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [preferredMode, setMobileMode] = useState<'grid' | 'singleDay'>('grid');
  const compact = useSyncExternalStore(subscribeCompact, getCompact, () => true);
  const mobileMode = compact ? 'singleDay' : preferredMode;

  const getShiftsForDate = (dateStr: string) => {
    return shifts
      .filter((s) => s.shiftDate === dateStr)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  };

  const renderShiftCard = (shift: ScheduledShiftWithDetails) => {
    const sTime = shift.startAt.includes('T')
      ? (shift.startAt.split('T')[1]?.slice(0, 5) ?? '')
      : shift.startAt.slice(11, 16);
    const eTime = shift.endAt.includes('T')
      ? (shift.endAt.split('T')[1]?.slice(0, 5) ?? '')
      : shift.endAt.slice(11, 16);

    const [sh = 0, sm = 0] = sTime.split(':').map(Number);
    const [eh = 0, em = 0] = eTime.split(':').map(Number);
    const isOvernight = eh < sh || (eh === sh && em <= sm);

    const assignedCount = shift.assignments.length;
    const hasWorkers = assignedCount > 0;
    const hasManager = shift.assignments.some(
      (a) => a.membership.role === 'ADMIN' || a.membership.role === 'SHIFT_MANAGER'
    );

    return (
      <div
        key={shift.id}
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          transition: 'border-color 0.15s ease',
        }}
      >
        {/* Template name & overnight indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.875rem',
              color: '#111827',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {shift.templateName || 'מותאמת אישית'}
          </span>

          {isOvernight ? (
            <Badge
              variant="warning"
              style={{
                fontSize: '0.6875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 6px',
              }}
            >
              <MoonIcon size={10} />
              <span>לילה</span>
            </Badge>
          ) : (
            <Badge
              variant="neutral"
              style={{
                fontSize: '0.6875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 6px',
              }}
            >
              <SunIcon size={10} />
              <span>יום</span>
            </Badge>
          )}
        </div>

        {/* Shift Timing */}
        <div
          style={{
            backgroundColor: '#F9FAFB',
            borderRadius: '6px',
            border: '1px solid #E5E7EB',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8125rem',
            color: '#D97706',
            fontWeight: 700,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClockIcon size={14} />
            <bdi dir="ltr">{`${sTime} — ${eTime}`}</bdi>
          </div>
          {isOvernight && <span style={{ fontSize: '0.6875rem', color: '#6B7280' }}>+1</span>}
        </div>

        {/* Assigned Staff Preview */}
        <div
          onClick={() => onOpenQuickAssign(shift)}
          style={{
            backgroundColor: hasWorkers ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.06)',
            border: hasWorkers
              ? '1px solid rgba(34, 197, 94, 0.3)'
              : '1px dashed rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '8px 10px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
              <UsersIcon size={13} style={{ color: hasWorkers ? '#16A34A' : '#EF4444' }} />
              <strong style={{ color: '#111827' }}>{assignedCount} עובדים</strong>
            </div>

            {hasWorkers && !hasManager && (
              <span title="ללא מנהל משמרת" style={{ color: '#D97706', display: 'flex' }}>
                <WarningIcon size={13} />
              </span>
            )}
          </div>

          {assignedCount === 0 ? (
            <div style={{ fontSize: '0.75rem', color: '#DC2626' }}>לחץ כאן לשיבוץ צוות</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {shift.assignments.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  style={{
                    fontSize: '0.6875rem',
                    color: '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {a.user.fullName}
                  </span>
                  <span style={{ fontSize: '0.625rem', color: '#6B7280' }}>
                    {a.membership.role === 'ADMIN'
                      ? 'מנהל'
                      : a.membership.role === 'SHIFT_MANAGER'
                        ? 'אחמ״ש'
                        : 'עובד'}
                  </span>
                </div>
              ))}
              {assignedCount > 3 && (
                <div style={{ fontSize: '0.6875rem', color: '#6B7280', fontStyle: 'italic' }}>
                  + עוד {assignedCount - 3} עובדים...
                </div>
              )}
            </div>
          )}
        </div>

        {shift.notes && (
          <div
            style={{
              fontSize: '0.6875rem',
              color: '#4B5563',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              padding: '4px 8px',
              borderRadius: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {shift.notes}
          </div>
        )}

        {/* Action Toolbar */}
        {canEdit && isDraft && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid #E5E7EB',
              paddingTop: '8px',
              marginTop: '2px',
            }}
          >
            <button
              onClick={() => onOpenQuickAssign(shift)}
              title="שיבוץ מהיר"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ys-color-brand-yellow)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
              }}
            >
              <UsersIcon size={13} />
              <span>צוות</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => onOpenDuplicateShift(shift)}
                title="שכפל משמרת"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <CopyIcon size={14} />
              </button>

              <button
                onClick={() => onOpenEditShift(shift)}
                title="ערוך שעות"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <EditIcon size={14} />
              </button>

              <button
                onClick={() => onDeleteShift(shift.id)}
                title="מחק משמרת"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <TrashIcon size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* View Switcher for Narrower Screens / Mobile */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '8px',
        }}
      >
        <div className="schedule-view-options" hidden={compact}>
          <button
            onClick={() => setMobileMode('grid')}
            style={{
              backgroundColor: mobileMode === 'grid' ? 'var(--ys-color-brand-yellow)' : '#FFFFFF',
              color: mobileMode === 'grid' ? '#111827' : '#4B5563',
              border:
                mobileMode === 'grid'
                  ? '1px solid var(--ys-color-brand-yellow)'
                  : '1px solid #E5E7EB',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            תצוגת רשת שבועית
          </button>

          <button
            onClick={() => setMobileMode('singleDay')}
            style={{
              backgroundColor:
                mobileMode === 'singleDay' ? 'var(--ys-color-brand-yellow)' : '#FFFFFF',
              color: mobileMode === 'singleDay' ? '#111827' : '#4B5563',
              border:
                mobileMode === 'singleDay'
                  ? '1px solid var(--ys-color-brand-yellow)'
                  : '1px solid #E5E7EB',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            תצוגת יום בודד
          </button>
        </div>

        <div style={{ fontSize: '0.8125rem', color: '#6B7280' }}>
          סה״כ {shifts.length} משמרות בסידור השבועי
        </div>
      </div>

      {/* Mode 1: Single Day Focused View (Ideal for mobile / compact view) */}
      {mobileMode === 'singleDay' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Day Selector Pills */}
          <div className="schedule-day-tabs" role="group" aria-label="בחירת יום">
            {HEBREW_DAYS.map((d) => {
              const dayDate = addDays(weekStartDate, d.index);
              const dayShifts = getShiftsForDate(dayDate);
              const isSelected = activeDayIndex === d.index;

              return (
                <button
                  key={d.index}
                  aria-pressed={isSelected}
                  aria-label={`${d.name} ${formatDateDisplay(dayDate)}`}
                  onClick={() => setActiveDayIndex(d.index)}
                  style={{
                    flex: '1 0 auto',
                    minWidth: 0,
                    backgroundColor: isSelected ? '#FFFBEB' : '#FFFFFF',
                    border: isSelected
                      ? '2px solid var(--ys-color-brand-yellow)'
                      : '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '8px 2px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: isSelected ? '#111827' : '#374151',
                    }}
                  >
                    {d.short}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                    {formatDateDisplay(dayDate)}
                  </span>
                  <Badge
                    variant={dayShifts.length > 0 ? 'brandYellow' : 'neutral'}
                    style={{ fontSize: '0.625rem' }}
                  >
                    {dayShifts.length}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Active Day Shift Card Stack */}
          {(() => {
            const activeDay = HEBREW_DAYS[activeDayIndex] ?? HEBREW_DAYS[0]!;
            const dayDate = addDays(weekStartDate, activeDay.index);
            const dayShifts = getShiftsForDate(dayDate);

            return (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #E5E7EB',
                  }}
                >
                  <div>
                    <h3
                      style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}
                    >
                      {activeDay.name} • {formatDateDisplay(dayDate)}
                    </h3>
                    <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>
                      {dayShifts.length} משמרות מתוכננות
                    </span>
                  </div>

                  {canEdit && isDraft && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onOpenAddShift(dayDate)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <PlusIcon size={14} />
                      <span>הוסף משמרת</span>
                    </Button>
                  )}
                </div>

                {dayShifts.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px 0',
                      color: '#9CA3AF',
                      fontSize: '0.875rem',
                    }}
                  >
                    אין משמרות ביום זה
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                      gap: '14px',
                    }}
                  >
                    {dayShifts.map((s) => renderShiftCard(s))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Mode 2: 7-Column Weekly Grid */}
      {mobileMode === 'grid' && (
        <div
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '12px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(210px, 1fr))',
              gap: '12px',
              minWidth: '1470px', // Ensures clean column width on desktops/wide screens
              direction: 'rtl',
            }}
          >
            {HEBREW_DAYS.map((day) => {
              const dayDate = addDays(weekStartDate, day.index);
              const dayShifts = getShiftsForDate(dayDate);

              return (
                <div
                  key={day.index}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '480px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Column Header */}
                  <div
                    style={{
                      backgroundColor: '#F9FAFB',
                      borderBottom: '1px solid #E5E7EB',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#111827' }}>
                          {day.short}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                          {formatDateDisplay(dayDate)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#6B7280', marginTop: '2px' }}>
                        {dayShifts.length} משמרות
                      </div>
                    </div>

                    {canEdit && isDraft && (
                      <button
                        onClick={() => onOpenAddShift(dayDate)}
                        title={`הוסף משמרת ל${day.name}`}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #D1D5DB',
                          borderRadius: '50%',
                          width: '26px',
                          height: '26px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#111827',
                          cursor: 'pointer',
                          padding: 0,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <PlusIcon size={14} />
                      </button>
                    )}
                  </div>

                  {/* Shifts in Column */}
                  <div
                    style={{
                      padding: '12px',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      backgroundColor: '#F9FAFB',
                    }}
                  >
                    {dayShifts.length === 0 ? (
                      <div
                        style={{
                          height: '100%',
                          minHeight: '120px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9CA3AF',
                          fontSize: '0.75rem',
                          fontStyle: 'italic',
                          border: '1px dashed #D1D5DB',
                          borderRadius: '6px',
                        }}
                      >
                        אין משמרות
                      </div>
                    ) : (
                      dayShifts.map((s) => renderShiftCard(s))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
