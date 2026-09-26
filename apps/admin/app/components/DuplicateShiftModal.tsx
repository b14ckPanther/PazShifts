'use client';

import React, { useId, useState, useTransition } from 'react';
import type { ScheduledShiftWithDetails } from '@yellowshifts/types';
import { duplicateShiftAction } from '../actions/schedules';
import { Button, Dialog } from '@yellowshifts/ui';
import { ClockIcon, InfoIcon, WarningIcon } from '@yellowshifts/icons';

interface DuplicateShiftModalProps {
  stationId: string;
  scheduleId: string;
  shift: ScheduledShiftWithDetails;
  weekStartDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

const HEBREW_DAYS = [
  { index: 0, name: 'יום ראשון' },
  { index: 1, name: 'יום שני' },
  { index: 2, name: 'יום שלישי' },
  { index: 3, name: 'יום רביעי' },
  { index: 4, name: 'יום חמישי' },
  { index: 5, name: 'יום שישי' },
  { index: 6, name: 'יום שבת' },
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

export function DuplicateShiftModal({
  stationId,
  scheduleId,
  shift,
  weekStartDate,
  onClose,
  onSuccess,
}: DuplicateShiftModalProps) {
  const [targetDate, setTargetDate] = useState(shift.shiftDate);
  const [notes, setNotes] = useState(shift.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();

  const handleDuplicate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await duplicateShiftAction(
        stationId,
        scheduleId,
        shift.id,
        targetDate,
        notes.trim() || null
      );

      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'שגיאה בשכפול משמרת');
      }
    });
  };

  const sTime = shift.startAt.includes('T')
    ? (shift.startAt.split('T')[1]?.slice(0, 5) ?? '')
    : shift.startAt.slice(11, 16);
  const eTime = shift.endAt.includes('T')
    ? (shift.endAt.split('T')[1]?.slice(0, 5) ?? '')
    : shift.endAt.slice(11, 16);

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!isPending}
      title="שכפול משמרת"
      footer={
        <>
          <Button type="submit" form={`${fieldId}-form`} variant="primary" isLoading={isPending}>
            שכפל משמרת
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            ביטול
          </Button>
        </>
      }
    >
      <form id={`${fieldId}-form`} className="schedule-dialog-form" onSubmit={handleDuplicate}>
        {/* Source shift summary */}
        <p className="schedule-dialog-context">
          <strong>{shift.templateName || 'משמרת מותאמת אישית'}</strong>
          <ClockIcon size={15} aria-hidden="true" />
          <bdi dir="ltr" className="ys-num">{`${sTime}–${eTime}`}</bdi>
        </p>

        {error && (
          <p className="admin-feedback admin-feedback--error" role="alert">
            <WarningIcon size={18} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <div className="ys-form-field">
          <label className="ys-label" htmlFor={`${fieldId}-target`}>
            בחר יום יעד לשכפול המשמרת <span className="ys-label-required">*</span>
          </label>
          <select
            id={`${fieldId}-target`}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            required
          >
            {HEBREW_DAYS.map((d) => {
              const dayDate = addDays(weekStartDate, d.index);
              const isSame = dayDate === shift.shiftDate;
              return (
                <option key={dayDate} value={dayDate}>
                  {d.name} • {formatDateDisplay(dayDate)} {isSame ? '(באותו היום)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div className="ys-form-field">
          <label className="ys-label" htmlFor={`${fieldId}-notes`}>
            הערות למשמרת המשוכפלת
          </label>
          <input
            id={`${fieldId}-notes`}
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות אופציונליות..."
          />
        </div>

        <p className="schedule-dialog-note">
          <InfoIcon size={16} aria-hidden="true" />
          <span>הערה: שכפול יוצר משמרת חדשה לחלוטין ללא שיבוצי עובדים, כדי לאפשר שיבוץ נפרד.</span>
        </p>
      </form>
    </Dialog>
  );
}
