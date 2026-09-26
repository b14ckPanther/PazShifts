'use client';

import React, { useId, useState, useTransition } from 'react';
import type { CopyWeekResult } from '@yellowshifts/types';
import { copyPreviousWeekAction } from '../actions/schedules';
import { Button, Dialog } from '@yellowshifts/ui';
import { WarningIcon } from '@yellowshifts/icons';

interface CopyPreviousWeekModalProps {
  stationId: string;
  targetWeekStartDate: string;
  onClose: () => void;
  onSuccess: (result: CopyWeekResult) => void;
}

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

export function CopyPreviousWeekModal({
  stationId,
  targetWeekStartDate,
  onClose,
  onSuccess,
}: CopyPreviousWeekModalProps) {
  const [copyAssignments, setCopyAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();

  const sourceWeekStartDate = addDays(targetWeekStartDate, -7);

  const handleCopy = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await copyPreviousWeekAction(
        stationId,
        sourceWeekStartDate,
        targetWeekStartDate,
        copyAssignments
      );

      if (res.success) {
        onSuccess({
          targetScheduleId: res.id ?? '',
          copiedShifts: res.copiedShifts ?? 0,
          copiedAssignments: res.copiedAssignments ?? 0,
          skippedInactiveWorkers: res.skippedInactiveWorkers ?? 0,
        });
      } else {
        setError(res.error || 'שגיאה בהעתקת שבוע קודם');
      }
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!isPending}
      title="העתקת סידור משבוע קודם"
      description={
        <>
          העתקת כל המשמרות מהשבוע הקודם (
          <bdi dir="ltr" className="ys-num">
            {formatDateDisplay(sourceWeekStartDate)}
          </bdi>
          ) לשבוע הנוכחי (
          <bdi dir="ltr" className="ys-num">
            {formatDateDisplay(targetWeekStartDate)}
          </bdi>
          ).
        </>
      }
      footer={
        <>
          <Button type="submit" form={`${fieldId}-form`} variant="primary" isLoading={isPending}>
            אשר והעתק שבוע
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            ביטול
          </Button>
        </>
      }
    >
      <form id={`${fieldId}-form`} className="schedule-dialog-form" onSubmit={handleCopy}>
        {error && (
          <p className="admin-feedback admin-feedback--error" role="alert">
            <WarningIcon size={18} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <label className="schedule-check-option" htmlFor={`${fieldId}-assignments`}>
          <input
            id={`${fieldId}-assignments`}
            type="checkbox"
            checked={copyAssignments}
            onChange={(e) => setCopyAssignments(e.target.checked)}
          />
          <span className="schedule-check-option-text">
            <strong>העתק גם שיבוצי עובדים</strong>
            <span>רק עובדים שעדיין פעילים בתחנה ישובצו. עובדים שהושבתו ידולגו באופן בטוח.</span>
          </span>
        </label>

        <p className="schedule-dialog-note is-warning">
          <WarningIcon size={16} aria-hidden="true" />
          <span>המשמרות יתווספו לסידור העבודה הנוכחי בסטטוס טיוטה (DRAFT).</span>
        </p>
      </form>
    </Dialog>
  );
}
