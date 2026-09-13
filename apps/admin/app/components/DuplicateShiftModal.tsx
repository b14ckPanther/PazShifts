'use client';

import React, { useState, useTransition } from 'react';
import type { ScheduledShiftWithDetails } from '@yellowshifts/types';
import { duplicateShiftAction } from '../actions/schedules';
import { Button } from '@yellowshifts/ui';
import { CloseIcon, CopyIcon, ClockIcon } from '@yellowshifts/icons';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 110,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          direction: 'rtl',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CopyIcon size={20} style={{ color: 'var(--ys-color-brand-yellow)' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>
              שכפול משמרת
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Source Shift Summary */}
        <div
          style={{
            backgroundColor: '#F9FAFB',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: '0.875rem',
            border: '1px solid #E5E7EB',
          }}
        >
          <div style={{ fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
            {shift.templateName || 'משמרת מותאמת אישית'}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#D97706',
              fontWeight: 600,
            }}
          >
            <ClockIcon size={14} />
            <bdi dir="ltr">{`${sTime} — ${eTime}`}</bdi>
          </div>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleDuplicate}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              בחר יום יעד לשכפול המשמרת *
            </label>
            <select
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
              style={{
                width: '100%',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                padding: '10px 12px',
                color: '#111827',
                fontSize: '0.9375rem',
              }}
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

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              הערות למשמרת המשוכפלת
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות אופציונליות..."
              style={{
                width: '100%',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                padding: '10px 12px',
                color: '#111827',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
            הערה: שכפול יוצר משמרת חדשה לחלוטין ללא שיבוצי עובדים, כדי לאפשר שיבוץ נפרד.
          </p>

          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}
          >
            <Button type="button" variant="secondary" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" variant="primary" disabled={isPending} isLoading={isPending}>
              שכפל משמרת
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
