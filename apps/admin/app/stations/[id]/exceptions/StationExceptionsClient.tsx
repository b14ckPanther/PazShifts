'use client';

import React, { useId, useState } from 'react';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { Card, EmptyState } from '@yellowshifts/ui';
import {
  CalendarClockIcon,
  CircleCheckIcon,
  DangerIcon,
  EditIcon,
  SuccessIcon,
  WarningIcon,
} from '@yellowshifts/icons';
import type {
  Station,
  AttendanceException,
  AttendanceDeviation,
  StationExceptionsResult,
} from '@yellowshifts/types';
import '../../../styles/admin-exceptions.css';

interface StationExceptionsClientProps {
  station: Station;
  exceptionsResult: StationExceptionsResult;
  isPlatformAdmin: boolean;
  isStationAdmin: boolean;
}

const DEVIATION_LABELS: Record<AttendanceDeviation, string> = {
  ON_TIME: 'בזמן',
  LATE: 'איחור',
  EARLY_LEAVE: 'יציאה מוקדמת',
  LATE_AND_EARLY_LEAVE: 'איחור ויציאה מוקדמת',
  NO_SHOW: 'אי-הגעה',
  UNSCHEDULED: 'משמרת לא מתוכננת',
  LEFT_OPEN: 'משמרת לא נסגרה',
};

type DeviationTone = 'danger' | 'warning' | 'info' | 'success';

const DEVIATION_TONES: Record<AttendanceDeviation, DeviationTone> = {
  ON_TIME: 'success',
  LATE: 'warning',
  EARLY_LEAVE: 'warning',
  LATE_AND_EARLY_LEAVE: 'danger',
  NO_SHOW: 'danger',
  UNSCHEDULED: 'info',
  LEFT_OPEN: 'danger',
};

type FilterType = 'ALL' | AttendanceDeviation;

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'ALL', label: 'כל החריגות' },
  { value: 'LEFT_OPEN', label: 'משמרות לא נסגרו' },
  { value: 'NO_SHOW', label: 'אי-הגעות' },
  { value: 'LATE', label: 'איחורים' },
  { value: 'EARLY_LEAVE', label: 'יציאות מוקדמות' },
  { value: 'LATE_AND_EARLY_LEAVE', label: 'איחור ויציאה מוקדמת' },
  { value: 'UNSCHEDULED', label: 'כניסות לא מתוכננות' },
];

function formatTime(isoString: string | null, timezone: string): string {
  if (!isoString) return '--:--';
  try {
    return new Intl.DateTimeFormat('he-IL', {
      timeZone: timezone || 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return isoString.slice(11, 16);
  }
}

function getDeviationIcon(deviation: AttendanceDeviation, size: number = 16) {
  switch (deviation) {
    case 'LEFT_OPEN':
    case 'NO_SHOW':
    case 'LATE_AND_EARLY_LEAVE':
      return <DangerIcon size={size} aria-hidden="true" />;
    case 'LATE':
    case 'EARLY_LEAVE':
      return <WarningIcon size={size} aria-hidden="true" />;
    case 'UNSCHEDULED':
      return <CalendarClockIcon size={size} aria-hidden="true" />;
    case 'ON_TIME':
    default:
      return <SuccessIcon size={size} aria-hidden="true" />;
  }
}

export function StationExceptionsClient({
  station,
  exceptionsResult,
  isPlatformAdmin,
  isStationAdmin,
}: StationExceptionsClientProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const filterId = useId();
  const timezone = station.timezone || 'Asia/Jerusalem';

  const { exceptions, tolerances, totalScheduledShifts, totalAttendanceRecords } = exceptionsResult;

  const filteredExceptions =
    filter === 'ALL' ? exceptions : exceptions.filter((e) => e.deviation === filter);

  // Count by deviation type
  const countByDeviation: Partial<Record<AttendanceDeviation, number>> = {};
  for (const ex of exceptions) {
    countByDeviation[ex.deviation] = (countByDeviation[ex.deviation] || 0) + 1;
  }

  return (
    <div className="station-exceptions">
      {/* Summary Stats */}
      <p className="att-facts">
        <span className="att-fact">
          <span className="ys-num">{totalScheduledShifts}</span> משמרות מתוכננות
        </span>
        <span className="att-fact">
          <span className="ys-num">{totalAttendanceRecords}</span> רשומות נוכחות
        </span>
        <span className={`att-fact${exceptions.length > 0 ? ' att-fact--attention' : ''}`}>
          {exceptions.length > 0 ? (
            <WarningIcon size={16} aria-hidden="true" />
          ) : (
            <CircleCheckIcon size={16} aria-hidden="true" />
          )}
          <span className="ys-num">{exceptions.length}</span> חריגות היום
        </span>
      </p>

      {/* Tolerance Settings Info */}
      {(isPlatformAdmin || isStationAdmin) && (
        <div className="exceptions-tolerances">
          <span className="exceptions-tolerances-title">הגדרות סבילות:</span>
          <dl className="exceptions-tolerances-list">
            <div>
              <dt>איחור מותר:</dt>
              <dd>
                <span className="ys-num">{tolerances.allowedLateMinutes}</span> דק׳
              </dd>
            </div>
            <div>
              <dt>יציאה מוקדמת:</dt>
              <dd>
                <span className="ys-num">{tolerances.allowedEarlyLeaveMinutes}</span> דק׳
              </dd>
            </div>
            <div>
              <dt>משמרת פתוחה:</dt>
              <dd>
                <span className="ys-num">{tolerances.leftOpenWarningHours}</span> שעות
              </dd>
            </div>
          </dl>
          <Link href={`/stations/${station.id}`} className="exceptions-tolerances-edit">
            <EditIcon size={16} aria-hidden="true" />
            ערוך
          </Link>
        </div>
      )}

      {/* Filter & Exception List */}
      <section className="admin-section" aria-labelledby={`${filterId}-title`}>
        <div className="admin-toolbar exceptions-toolbar">
          <div className="exceptions-heading">
            <h2 id={`${filterId}-title`} className="admin-section-title">
              חריגות נוכחות — היום
            </h2>
            <p className="admin-section-description" role="status">
              {filteredExceptions.length === 0
                ? 'אין חריגות נוכחות ליום הנוכחי'
                : `${filteredExceptions.length} חריגות`}
            </p>
          </div>
          <div className="ys-form-field exceptions-filter">
            <label className="ys-label" htmlFor={filterId}>
              סינון לפי סוג
            </label>
            <select
              id={filterId}
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterType)}
            >
              {FILTER_OPTIONS.map((option) => {
                const count =
                  option.value === 'ALL'
                    ? undefined
                    : countByDeviation[option.value as AttendanceDeviation];
                return (
                  <option key={option.value} value={option.value}>
                    {count !== undefined ? `${option.label} (${count})` : option.label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {filteredExceptions.length === 0 ? (
          <Card>
            <EmptyState
              icon={<SuccessIcon size={24} />}
              title="אין חריגות נוכחות"
              description={
                filter === 'ALL'
                  ? 'כל רשומות הנוכחות בטווח הסבילות המוגדר'
                  : 'אין היום חריגות מהסוג שנבחר.'
              }
            />
          </Card>
        ) : (
          <div className="ys-table-wrap ys-table-wrap--stack exceptions-table">
            <table className="ys-table">
              <thead>
                <tr>
                  <th scope="col">עובד</th>
                  <th scope="col">סוג חריגה</th>
                  <th scope="col">משמרת מתוכננת</th>
                  <th scope="col">נוכחות בפועל</th>
                  <th scope="col">פירוט</th>
                  <th scope="col">
                    <span className="ys-visually-hidden">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredExceptions.map((exception) => (
                  <ExceptionRow
                    key={exception.id}
                    exception={exception}
                    timezone={timezone}
                    stationId={station.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exception Row Component
// ---------------------------------------------------------------------------

function ExceptionRow({
  exception,
  timezone,
  stationId,
}: {
  exception: AttendanceException;
  timezone: string;
  stationId: string;
}) {
  const tone = DEVIATION_TONES[exception.deviation];
  const deviationLabel = DEVIATION_LABELS[exception.deviation];
  const hasLate = exception.lateMinutes !== null && exception.lateMinutes > 0;
  const hasEarly = exception.earlyLeaveMinutes !== null && exception.earlyLeaveMinutes > 0;
  const hasOpen = exception.openHours !== null;

  return (
    <tr>
      <td className="exceptions-person">
        <span className="exceptions-person-name">{exception.worker.fullName}</span>
        {exception.worker.employeeCode && (
          <span className="exceptions-person-code">
            קוד: <bdi className="ys-num">{exception.worker.employeeCode}</bdi>
          </span>
        )}
      </td>

      <td data-label="סוג חריגה">
        <span className={`att-deviation att-deviation--${tone}`}>
          {getDeviationIcon(exception.deviation, 14)}
          {deviationLabel}
        </span>
      </td>

      <td data-label="משמרת מתוכננת">
        {exception.scheduledShift ? (
          <span className="exceptions-cell">
            <span>{exception.scheduledShift.templateName || 'משמרת'}</span>
            <bdi dir="ltr" className="ys-num exceptions-range">
              {formatTime(exception.scheduledStart, timezone)}–
              {formatTime(exception.scheduledEnd, timezone)}
            </bdi>
          </span>
        ) : (
          <span className="exceptions-muted">ללא שיבוץ</span>
        )}
      </td>

      <td data-label="נוכחות בפועל">
        {exception.actualClockIn ? (
          <span className="exceptions-cell">
            <bdi dir="ltr" className="ys-num exceptions-range">
              {formatTime(exception.actualClockIn, timezone)}
              {exception.actualClockOut ? `–${formatTime(exception.actualClockOut, timezone)}` : ''}
            </bdi>
            {!exception.actualClockOut && <span className="exceptions-muted">(פעיל)</span>}
          </span>
        ) : (
          <span className="exceptions-missing">לא הגיע</span>
        )}
      </td>

      <td data-label="פירוט">
        {hasLate || hasEarly || hasOpen ? (
          <span className="exceptions-detail">
            {hasLate && (
              <span>
                איחור: <span className="ys-num">{exception.lateMinutes}</span> דק׳
              </span>
            )}
            {hasEarly && (
              <span>
                יציאה מוקדמת: <span className="ys-num">{exception.earlyLeaveMinutes}</span> דק׳
              </span>
            )}
            {hasOpen && (
              <span>
                פתוח: <span className="ys-num">{exception.openHours}</span> שעות
              </span>
            )}
          </span>
        ) : (
          <span className="exceptions-muted">—</span>
        )}
      </td>

      <td className="exceptions-action">
        {exception.attendanceRecord && (
          <Link
            href={`/stations/${stationId}/attendance`}
            className="ys-button ys-button--secondary"
          >
            צפייה
            <span className="ys-visually-hidden">
              {' '}
              ברשומת הנוכחות של {exception.worker.fullName}
            </span>
          </Link>
        )}
      </td>
    </tr>
  );
}
