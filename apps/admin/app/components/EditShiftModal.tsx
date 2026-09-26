'use client';

import React, { useId, useState, useTransition } from 'react';
import type { ScheduledShiftWithDetails } from '@yellowshifts/types';
import { updateScheduledShiftTimesAction } from '../actions/schedules';
import { Button, Dialog } from '@yellowshifts/ui';
import { MoonIcon, SunIcon, WarningIcon } from '@yellowshifts/icons';

interface EditShiftModalProps {
  stationId: string;
  shift: ScheduledShiftWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditShiftModal({ stationId, shift, onClose, onSuccess }: EditShiftModalProps) {
  const sTime = shift.startAt.includes('T')
    ? (shift.startAt.split('T')[1]?.slice(0, 5) ?? '07:00')
    : shift.startAt.slice(11, 16);
  const eTime = shift.endAt.includes('T')
    ? (shift.endAt.split('T')[1]?.slice(0, 5) ?? '15:00')
    : shift.endAt.slice(11, 16);

  const [startTime, setStartTime] = useState(sTime);
  const [endTime, setEndTime] = useState(eTime);
  const [notes, setNotes] = useState(shift.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();

  const isOvernight = (() => {
    if (!startTime || !endTime) return false;
    const [sh = 0, sm = 0] = startTime.split(':').map(Number);
    const [eh = 0, em = 0] = endTime.split(':').map(Number);
    return eh < sh || (eh === sh && em <= sm);
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (startTime === endTime) {
      setError('שעת סיום חייבת להיות שונה משעת התחלה');
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.append('stationId', stationId);
    formData.append('shiftId', shift.id);
    formData.append('shiftDate', shift.shiftDate);
    formData.append('startTime', startTime);
    formData.append('endTime', endTime);
    formData.append('notes', notes.trim());

    startTransition(async () => {
      const res = await updateScheduledShiftTimesAction(null, formData);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'שגיאה בעדכון משמרת');
      }
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!isPending}
      title="עריכת זמני משמרת"
      description={
        <>
          {shift.templateName ? `${shift.templateName} · ` : ''}תאריך:{' '}
          <bdi dir="ltr" className="ys-num">
            {shift.shiftDate}
          </bdi>
        </>
      }
      footer={
        <>
          <Button type="submit" form={`${fieldId}-form`} variant="primary" isLoading={isPending}>
            שמור שינויים
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            ביטול
          </Button>
        </>
      }
    >
      <form id={`${fieldId}-form`} className="schedule-dialog-form" onSubmit={handleSubmit}>
        {error && (
          <p className="admin-feedback admin-feedback--error" role="alert">
            <WarningIcon size={18} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <div className="schedule-time-pair">
          <div className="ys-form-field">
            <label className="ys-label" htmlFor={`${fieldId}-start`}>
              שעת התחלה <span className="ys-label-required">*</span>
            </label>
            <input
              id={`${fieldId}-start`}
              type="time"
              dir="ltr"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="ys-form-field">
            <label className="ys-label" htmlFor={`${fieldId}-end`}>
              שעת סיום <span className="ys-label-required">*</span>
            </label>
            <input
              id={`${fieldId}-end`}
              type="time"
              dir="ltr"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        <p className={`schedule-shift-kind-note${isOvernight ? ' is-night' : ''}`}>
          {isOvernight ? (
            <MoonIcon size={16} aria-hidden="true" />
          ) : (
            <SunIcon size={16} aria-hidden="true" />
          )}
          <span>
            {isOvernight
              ? 'משמרת לילה: מסתיימת ביום שלמחרת'
              : 'משמרת יום: מתחילה ומסתיימת באותו היום'}
          </span>
        </p>

        <div className="ys-form-field">
          <label className="ys-label" htmlFor={`${fieldId}-notes`}>
            הערות למשמרת
          </label>
          <input
            id={`${fieldId}-notes`}
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="לדוגמה: אחראי פתיחה / חפיפת עובד"
          />
        </div>
      </form>
    </Dialog>
  );
}
