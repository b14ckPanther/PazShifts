'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
} from '@yellowshifts/ui';
import {
  ClockIcon,
  WarningIcon,
  DangerIcon,
  SuccessIcon,
  CalendarIcon,
  UserIcon,
  ChevronDownIcon,
} from '@yellowshifts/icons';
import type {
  Station,
  AttendanceException,
  AttendanceDeviation,
  StationExceptionsResult,
} from '@yellowshifts/types';

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

const DEVIATION_COLORS: Record<AttendanceDeviation, string> = {
  ON_TIME: '#10B981',
  LATE: '#F59E0B',
  EARLY_LEAVE: '#F59E0B',
  LATE_AND_EARLY_LEAVE: '#EF4444',
  NO_SHOW: '#EF4444',
  UNSCHEDULED: '#3B82F6',
  LEFT_OPEN: '#EF4444',
};

const DEVIATION_BG: Record<AttendanceDeviation, string> = {
  ON_TIME: 'rgba(16, 185, 129, 0.12)',
  LATE: 'rgba(245, 158, 11, 0.12)',
  EARLY_LEAVE: 'rgba(245, 158, 11, 0.12)',
  LATE_AND_EARLY_LEAVE: 'rgba(239, 68, 68, 0.12)',
  NO_SHOW: 'rgba(239, 68, 68, 0.12)',
  UNSCHEDULED: 'rgba(59, 130, 246, 0.12)',
  LEFT_OPEN: 'rgba(239, 68, 68, 0.12)',
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
      return <DangerIcon size={size} />;
    case 'LATE':
    case 'EARLY_LEAVE':
      return <WarningIcon size={size} />;
    case 'UNSCHEDULED':
      return <ClockIcon size={size} />;
    case 'ON_TIME':
    default:
      return <SuccessIcon size={size} />;
  }
}

export function StationExceptionsClient({
  station,
  exceptionsResult,
  isPlatformAdmin,
  isStationAdmin,
}: StationExceptionsClientProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Summary Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--ys-radius-md)',
            padding: '16px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: '12px', color: '#6B7280' }}>משמרות מתוכננות</span>
          <p style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0 0', color: '#111827' }}>
            {totalScheduledShifts}
          </p>
        </div>
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--ys-radius-md)',
            padding: '16px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: '12px', color: '#6B7280' }}>רשומות נוכחות</span>
          <p style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0 0', color: '#111827' }}>
            {totalAttendanceRecords}
          </p>
        </div>
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--ys-radius-md)',
            padding: '16px',
            border:
              exceptions.length > 0
                ? '1px solid rgba(239, 68, 68, 0.4)'
                : '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: '12px', color: '#6B7280' }}>חריגות היום</span>
          <p
            style={{
              fontSize: '22px',
              fontWeight: 700,
              margin: '4px 0 0',
              color: exceptions.length > 0 ? '#DC2626' : '#059669',
            }}
          >
            {exceptions.length}
          </p>
        </div>
      </div>

      {/* Tolerance Settings Info */}
      {(isPlatformAdmin || isStationAdmin) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            padding: '12px 16px',
            backgroundColor: '#F9FAFB',
            borderRadius: 'var(--ys-radius-md)',
            border: '1px solid #E5E7EB',
            fontSize: '13px',
            color: '#4B5563',
          }}
        >
          <span style={{ fontWeight: 600, color: '#111827' }}>הגדרות סבילות:</span>
          <span>איחור מותר: {tolerances.allowedLateMinutes} דק&lsquo;</span>
          <span>יציאה מוקדמת: {tolerances.allowedEarlyLeaveMinutes} דק&lsquo;</span>
          <span>משמרת פתוחה: {tolerances.leftOpenWarningHours} שעות</span>
          <Link
            href={`/stations/${station.id}`}
            style={{ color: '#D97706', textDecoration: 'none', fontWeight: 600 }}
          >
            ערוך
          </Link>
        </div>
      )}

      {/* Filter & Exception List */}
      <Card
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <CardTitle style={{ fontSize: '17px', color: '#111827' }}>
                חריגות נוכחות — היום
              </CardTitle>
              <CardDescription style={{ color: '#4B5563' }}>
                {filteredExceptions.length === 0
                  ? 'אין חריגות נוכחות ליום הנוכחי'
                  : `${filteredExceptions.length} חריגות`}
              </CardDescription>
            </div>

            {/* Filter Dropdown */}
            <div style={{ position: 'relative' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {FILTER_OPTIONS.find((o) => o.value === filter)?.label}
                  <ChevronDownIcon size={14} />
                </span>
              </Button>
              {showFilterDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: 'var(--ys-radius-md)',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    zIndex: 50,
                    minWidth: '200px',
                    overflow: 'hidden',
                  }}
                >
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilter(option.value);
                        setShowFilterDropdown(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: filter === option.value ? '#D97706' : '#374151',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'right',
                        direction: 'rtl',
                      }}
                    >
                      <span>{option.label}</span>
                      {option.value !== 'ALL' &&
                        countByDeviation[option.value as AttendanceDeviation] !== undefined && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#4B5563',
                              backgroundColor: '#F3F4F6',
                              padding: '2px 8px',
                              borderRadius: '10px',
                            }}
                          >
                            {countByDeviation[option.value as AttendanceDeviation]}
                          </span>
                        )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredExceptions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 16px',
                color: '#6B7280',
              }}
            >
              <SuccessIcon size={40} color="#10B981" />
              <p
                style={{
                  fontSize: '15px',
                  margin: '12px 0 4px',
                  fontWeight: 600,
                  color: '#111827',
                }}
              >
                אין חריגות נוכחות
              </p>
              <p style={{ fontSize: '13px', margin: 0 }}>כל רשומות הנוכחות בטווח הסבילות המוגדר</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredExceptions.map((exception) => (
                <ExceptionRow
                  key={exception.id}
                  exception={exception}
                  timezone={timezone}
                  stationId={station.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
  const deviationColor = DEVIATION_COLORS[exception.deviation];
  const deviationBg = DEVIATION_BG[exception.deviation];
  const deviationLabel = DEVIATION_LABELS[exception.deviation];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 16px',
        backgroundColor: '#F9FAFB',
        borderRadius: 'var(--ys-radius-md)',
        border: `1px solid #E5E7EB`,
        flexWrap: 'wrap',
      }}
    >
      {/* Deviation Icon */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: deviationBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: deviationColor,
          flexShrink: 0,
        }}
      >
        {getDeviationIcon(exception.deviation, 18)}
      </div>

      {/* Worker Info */}
      <div style={{ flex: '1 1 180px', minWidth: '140px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UserIcon size={14} color="#6B7280" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
            {exception.worker.fullName}
          </span>
        </div>
        {exception.worker.employeeCode && (
          <span style={{ fontSize: '11px', color: '#6B7280' }}>
            קוד: {exception.worker.employeeCode}
          </span>
        )}
      </div>

      {/* Scheduled Shift */}
      <div style={{ flex: '1 1 160px', minWidth: '130px' }}>
        <span style={{ fontSize: '11px', color: '#6B7280', display: 'block' }}>משמרת מתוכננת</span>
        {exception.scheduledShift ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <CalendarIcon size={12} color="#6B7280" />
            <span style={{ fontSize: '13px', color: '#374151' }}>
              {exception.scheduledShift.templateName || 'משמרת'}{' '}
              {formatTime(exception.scheduledStart, timezone)}-
              {formatTime(exception.scheduledEnd, timezone)}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px', display: 'block' }}>
            ללא שיבוץ
          </span>
        )}
      </div>

      {/* Actual Times */}
      <div style={{ flex: '1 1 140px', minWidth: '110px' }}>
        <span style={{ fontSize: '11px', color: '#6B7280', display: 'block' }}>נוכחות בפועל</span>
        {exception.actualClockIn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <ClockIcon size={12} color="#6B7280" />
            <span style={{ fontSize: '13px', color: '#374151' }}>
              {formatTime(exception.actualClockIn, timezone)}
              {exception.actualClockOut
                ? ` - ${formatTime(exception.actualClockOut, timezone)}`
                : ' (פעיל)'}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: '13px', color: '#DC2626', marginTop: '2px', display: 'block' }}>
            לא הגיע
          </span>
        )}
      </div>

      {/* Deviation Detail */}
      <div style={{ flex: '0 0 auto', minWidth: '100px' }}>
        {exception.lateMinutes !== null && exception.lateMinutes > 0 && (
          <span style={{ fontSize: '12px', color: '#D97706', display: 'block' }}>
            איחור: {exception.lateMinutes} דק&lsquo;
          </span>
        )}
        {exception.earlyLeaveMinutes !== null && exception.earlyLeaveMinutes > 0 && (
          <span style={{ fontSize: '12px', color: '#D97706', display: 'block' }}>
            יציאה מוקדמת: {exception.earlyLeaveMinutes} דק&lsquo;
          </span>
        )}
        {exception.openHours !== null && (
          <span style={{ fontSize: '12px', color: '#DC2626', display: 'block' }}>
            פתוח: {exception.openHours} שעות
          </span>
        )}
      </div>

      {/* Deviation Badge */}
      <div style={{ flex: '0 0 auto' }}>
        <Badge
          variant="neutral"
          style={{ backgroundColor: deviationBg, color: deviationColor, fontWeight: 600 }}
        >
          {deviationLabel}
        </Badge>
      </div>

      {/* Link to Attendance Record */}
      {exception.attendanceRecord && (
        <div style={{ flex: '0 0 auto' }}>
          <Link href={`/stations/${stationId}/attendance`} style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="sm">
              צפייה
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
