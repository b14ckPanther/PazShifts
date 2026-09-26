'use client';

import React, { useState } from 'react';
import type {
  ScheduledShiftWithDetails,
  ShiftTemplate,
  StationMemberWithProfile,
} from '@yellowshifts/types';
import { Button } from '@yellowshifts/ui';
import {
  PlusIcon,
  UsersIcon,
  UserPlusIcon,
  CopyIcon,
  EditIcon,
  TrashIcon,
  MoonIcon,
  SunIcon,
  WarningIcon,
  CircleXIcon,
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

const ROLE_SHORT: Record<string, string> = {
  ADMIN: 'מנהל',
  SHIFT_MANAGER: 'אחמ״ש',
};

/** Hebrew count: the singular phrase for 1 ("עובד אחד"), otherwise "N <plural>". */
export function countText(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

/** A shift lacks a manager when no station admin or shift manager is assigned to it. */
export function shiftHasManager(shift: ScheduledShiftWithDetails): boolean {
  return shift.assignments.some(
    (a) => a.membership.role === 'ADMIN' || a.membership.role === 'SHIFT_MANAGER'
  );
}

function timeOf(value: string): string {
  return value.includes('T') ? (value.split('T')[1]?.slice(0, 5) ?? '') : value.slice(11, 16);
}

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
  // Active day in the single-day view (0 = Sunday)
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  // Desktop preference. Below 1024px CSS always shows the single-day view, so the
  // server render already matches the device and nothing jumps after hydration.
  const [preferredMode, setMobileMode] = useState<'grid' | 'singleDay'>('grid');
  const editable = canEdit && isDraft;

  const getShiftsForDate = (dateStr: string) => {
    return shifts
      .filter((s) => s.shiftDate === dateStr)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  };

  const renderShiftCard = (shift: ScheduledShiftWithDetails) => {
    const sTime = timeOf(shift.startAt);
    const eTime = timeOf(shift.endAt);

    const [sh = 0, sm = 0] = sTime.split(':').map(Number);
    const [eh = 0, em = 0] = eTime.split(':').map(Number);
    const isOvernight = eh < sh || (eh === sh && em <= sm);

    const assignedCount = shift.assignments.length;
    const hasWorkers = assignedCount > 0;
    const hasManager = shiftHasManager(shift);
    const staffing = !hasWorkers ? 'empty' : hasManager ? 'ok' : 'warning';
    const shiftName = shift.templateName || 'מותאמת אישית';

    return (
      <article key={shift.id} className="schedule-shift" data-staffing={staffing}>
        <div className="schedule-shift-head">
          <p className="schedule-shift-time ys-num">
            <bdi dir="ltr">{`${sTime}–${eTime}`}</bdi>
            {isOvernight && (
              <span className="schedule-shift-nextday">
                <span aria-hidden="true">+1</span>
                <span className="ys-visually-hidden">מסתיימת למחרת</span>
              </span>
            )}
          </p>
          <span className={`schedule-shift-kind${isOvernight ? ' is-night' : ''}`}>
            {isOvernight ? (
              <MoonIcon size={12} aria-hidden="true" />
            ) : (
              <SunIcon size={12} aria-hidden="true" />
            )}
            {isOvernight ? 'לילה' : 'יום'}
          </span>
        </div>

        <h4 className="schedule-shift-name">{shiftName}</h4>

        {/* Staffing summary; opens the quick assignment sheet */}
        <button
          type="button"
          className="schedule-shift-staff"
          onClick={() => onOpenQuickAssign(shift)}
        >
          <span className="schedule-shift-staffing">
            {staffing === 'empty' ? (
              <span className="schedule-shift-staffing-item is-empty">
                <CircleXIcon size={14} aria-hidden="true" />
                לא שובצו עובדים
              </span>
            ) : (
              <span className="schedule-shift-staffing-item">
                <UsersIcon size={14} aria-hidden="true" />
                {countText(assignedCount, 'עובד אחד', 'עובדים')}
              </span>
            )}
            {staffing === 'warning' && (
              <span className="schedule-shift-staffing-item is-warning">
                <WarningIcon size={13} aria-hidden="true" />
                ללא מנהל משמרת
              </span>
            )}
          </span>

          {hasWorkers && (
            <span className="schedule-shift-people">
              {shift.assignments.slice(0, 3).map((a) => (
                <span key={a.id} className="schedule-shift-person">
                  <span className="schedule-shift-person-name">{a.user.fullName}</span>
                  <span className="schedule-shift-person-role">
                    {ROLE_SHORT[a.membership.role] ?? 'עובד'}
                  </span>
                </span>
              ))}
              {assignedCount > 3 && (
                <span className="schedule-shift-more">
                  + עוד {countText(assignedCount - 3, 'עובד אחד', 'עובדים')}
                </span>
              )}
            </span>
          )}

          <span className="schedule-shift-cta">
            {editable ? (
              <UserPlusIcon size={14} aria-hidden="true" />
            ) : (
              <UsersIcon size={14} aria-hidden="true" />
            )}
            {editable ? 'שיבוץ צוות' : 'צפייה בצוות'}
          </span>
        </button>

        {shift.notes && <p className="schedule-shift-notes">{shift.notes}</p>}

        {editable && (
          <div className="schedule-shift-actions">
            <Button
              variant="ghost"
              iconOnly
              onClick={() => onOpenEditShift(shift)}
              aria-label={`עריכת שעות: ${shiftName} ${sTime}–${eTime}`}
              title="ערוך שעות"
            >
              <EditIcon size={17} />
            </Button>
            <Button
              variant="ghost"
              iconOnly
              onClick={() => onOpenDuplicateShift(shift)}
              aria-label={`שכפול משמרת: ${shiftName} ${sTime}–${eTime}`}
              title="שכפל משמרת"
            >
              <CopyIcon size={17} />
            </Button>
            <Button
              variant="ghost"
              iconOnly
              className="schedule-shift-delete"
              onClick={() => onDeleteShift(shift.id)}
              aria-label={`מחיקת משמרת: ${shiftName} ${sTime}–${eTime}`}
              title="מחק משמרת"
            >
              <TrashIcon size={17} />
            </Button>
          </div>
        )}
      </article>
    );
  };

  const renderEmptyDay = (dayDate: string, dayName: string) => (
    <div className="schedule-day-empty">
      <span>אין משמרות</span>
      {editable && (
        <Button
          variant="secondary"
          onClick={() => onOpenAddShift(dayDate)}
          rightIcon={<PlusIcon size={15} />}
          aria-label={`הוסף משמרת ל${dayName}`}
        >
          הוספה
        </Button>
      )}
    </div>
  );

  const activeDay = HEBREW_DAYS[activeDayIndex] ?? HEBREW_DAYS[0]!;
  const activeDayDate = addDays(weekStartDate, activeDay.index);
  const activeDayShifts = getShiftsForDate(activeDayDate);

  return (
    <div className="schedule-board" data-view={preferredMode}>
      <div className="schedule-board-toolbar">
        <div className="ys-segmented schedule-view-switch" role="group" aria-label="תצוגת הסידור">
          <button
            type="button"
            aria-pressed={preferredMode === 'grid'}
            onClick={() => setMobileMode('grid')}
          >
            תצוגת רשת שבועית
          </button>
          <button
            type="button"
            aria-pressed={preferredMode === 'singleDay'}
            onClick={() => setMobileMode('singleDay')}
          >
            תצוגת יום בודד
          </button>
        </div>

        <p className="schedule-board-total">
          סה״כ {countText(shifts.length, 'משמרת אחת', 'משמרות')} בסידור השבועי
        </p>
      </div>

      {/* Single-day view: always on phones and tablets, optional on desktop */}
      <div className="schedule-day-view">
        <div className="schedule-day-tabs" role="group" aria-label="בחירת יום">
          {HEBREW_DAYS.map((d) => {
            const dayDate = addDays(weekStartDate, d.index);
            const count = getShiftsForDate(dayDate).length;

            return (
              <button
                key={d.index}
                type="button"
                className="schedule-day-tab"
                aria-pressed={activeDayIndex === d.index}
                aria-label={`${d.name} ${formatDateDisplay(dayDate)}, ${countText(count, 'משמרת אחת', 'משמרות')}`}
                onClick={() => setActiveDayIndex(d.index)}
              >
                <span className="schedule-day-tab-name">{d.short}</span>
                <span className="schedule-day-tab-date ys-num">{formatDateDisplay(dayDate)}</span>
                <span className={`schedule-day-tab-count ys-num${count > 0 ? ' has-shifts' : ''}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <section className="schedule-day-panel" aria-labelledby="schedule-day-panel-title">
          <div className="schedule-day-panel-header">
            <div>
              <h3 id="schedule-day-panel-title" className="schedule-day-panel-title">
                {activeDay.name} ·{' '}
                <span className="ys-num">{formatDateDisplay(activeDayDate)}</span>
              </h3>
              <p className="schedule-day-panel-meta">
                {activeDayShifts.length === 1
                  ? 'משמרת אחת מתוכננת'
                  : `${activeDayShifts.length} משמרות מתוכננות`}
              </p>
            </div>

            {editable && activeDayShifts.length > 0 && (
              <Button
                variant="primary"
                onClick={() => onOpenAddShift(activeDayDate)}
                rightIcon={<PlusIcon size={15} />}
              >
                הוסף משמרת
              </Button>
            )}
          </div>

          {activeDayShifts.length === 0 ? (
            renderEmptyDay(activeDayDate, activeDay.name)
          ) : (
            <div className="schedule-day-cards">
              {activeDayShifts.map((s) => renderShiftCard(s))}
            </div>
          )}
        </section>
      </div>

      {/* Week grid: desktop only */}
      <div className="schedule-week-view">
        <div className="schedule-week-scroll">
          <div className="schedule-week-grid">
            {HEBREW_DAYS.map((day) => {
              const dayDate = addDays(weekStartDate, day.index);
              const dayShifts = getShiftsForDate(dayDate);

              return (
                <section
                  key={day.index}
                  className="schedule-day-column"
                  aria-label={`${day.name} ${formatDateDisplay(dayDate)}`}
                >
                  <div className="schedule-day-column-header">
                    <div className="schedule-day-column-title">
                      <h3 className="schedule-day-column-name">{day.short}</h3>
                      <span>
                        <span className="ys-num">{formatDateDisplay(dayDate)}</span> ·{' '}
                        {countText(dayShifts.length, 'משמרת אחת', 'משמרות')}
                      </span>
                    </div>

                    {editable && dayShifts.length > 0 && (
                      <Button
                        variant="ghost"
                        iconOnly
                        onClick={() => onOpenAddShift(dayDate)}
                        aria-label={`הוסף משמרת ל${day.name}`}
                        title={`הוסף משמרת ל${day.name}`}
                      >
                        <PlusIcon size={17} />
                      </Button>
                    )}
                  </div>

                  <div className="schedule-day-column-body">
                    {dayShifts.length === 0
                      ? renderEmptyDay(dayDate, day.name)
                      : dayShifts.map((s) => renderShiftCard(s))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
