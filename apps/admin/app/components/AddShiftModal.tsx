'use client';

import React, { useState, useEffect, useId, useTransition } from 'react';
import type { ShiftTemplate } from '@yellowshifts/types';
import { createScheduledShiftAction } from '../actions/schedules';
import { Button, Dialog } from '@yellowshifts/ui';
import { MoonIcon, SunIcon, WarningIcon } from '@yellowshifts/icons';

interface AddShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  stationId: string;
  scheduleId: string;
  shiftDate: string | null;
  templates: ShiftTemplate[];
  onSuccess: (message: string) => void;
}

function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.slice(0, 10).split('-');
  const y = parts[0] ?? '';
  const m = parts[1] ?? '';
  const d = parts[2] ?? '';
  return `${d}/${m}/${y}`;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

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

export function AddShiftModal({
  isOpen,
  onClose,
  stationId,
  scheduleId,
  shiftDate,
  templates,
  onSuccess,
}: AddShiftModalProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('07:00');
  const [endTime, setEndTime] = useState<string>('15:00');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  useEffect(() => {
    if (isOpen) {
      if (templates.length > 0 && templates[0]) {
        setSelectedTemplateId(templates[0].id);
        setStartTime(templates[0].startTime);
        setEndTime(templates[0].endTime);
      } else {
        setSelectedTemplateId('');
        setStartTime('07:00');
        setEndTime('15:00');
      }
      setNotes('');
      setError(null);
    }
  }, [isOpen, templates]);

  if (!isOpen || !shiftDate) return null;

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const found = templates.find((t) => t.id === templateId);
      if (found) {
        setStartTime(found.startTime);
        setEndTime(found.endTime);
      }
    }
  };

  const overnight = isShiftOvernight(startTime, endTime);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (startTime === endTime) {
      setError('שעת סיום חייבת להיות שונה משעת התחלה');
      return;
    }

    const formData = new FormData();
    formData.append('stationId', stationId);
    formData.append('scheduleId', scheduleId);
    formData.append('shiftDate', shiftDate);
    formData.append('startTime', startTime);
    formData.append('endTime', endTime);
    if (selectedTemplateId) {
      formData.append('shiftTemplateId', selectedTemplateId);
    }
    if (notes.trim()) {
      formData.append('notes', notes.trim());
    }

    startTransition(async () => {
      const res = await createScheduledShiftAction(null, formData);
      if (res.success) {
        onSuccess('משמרת חדשה נוספה בהצלחה לסידור השבועי');
        onClose();
      } else {
        setError(res.error || 'שגיאה בהוספת משמרת');
      }
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!isPending}
      title="הוספת משמרת חדשה"
      description={
        <>
          {getHebrewDayName(shiftDate)} ·{' '}
          <bdi dir="ltr" className="ys-num">
            {formatDateDisplay(shiftDate)}
          </bdi>
        </>
      }
      footer={
        <>
          <Button type="submit" form={`${fieldId}-form`} variant="primary" isLoading={isPending}>
            הוסף משמרת לסידור
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

        <div className="ys-form-field">
          <label className="ys-label" htmlFor={`${fieldId}-template`}>
            תבנית משמרת (אופציונלי)
          </label>
          <select
            id={`${fieldId}-template`}
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
          >
            <option value="">משמרת מותאמת אישית (ללא תבנית)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({`\u2066${t.startTime} — ${t.endTime}\u2069`})
              </option>
            ))}
          </select>
        </div>

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

        <p className={`schedule-shift-kind-note${overnight ? ' is-night' : ''}`}>
          {overnight ? (
            <MoonIcon size={16} aria-hidden="true" />
          ) : (
            <SunIcon size={16} aria-hidden="true" />
          )}
          <span>משך ואופי משמרת: {overnight ? 'לילה (מסתיים למחרת)' : 'יום'}</span>
        </p>

        <div className="ys-form-field">
          <label className="ys-label" htmlFor={`${fieldId}-notes`}>
            הערות והנחיות למשמרת (אופציונלי)
          </label>
          <textarea
            id={`${fieldId}-notes`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="למשל: דגש על בדיקת ניקיון משאבות..."
          />
        </div>
      </form>
    </Dialog>
  );
}
