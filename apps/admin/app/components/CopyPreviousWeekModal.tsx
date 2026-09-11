'use client';

import React, { useState, useTransition } from 'react';
import type { CopyWeekResult } from '@yellowshifts/types';
import { copyPreviousWeekAction } from '../actions/schedules';
import { Button } from '@yellowshifts/ui';
import { CloseIcon, CopyIcon, CheckSquareIcon, SquareIcon, WarningIcon } from '@yellowshifts/icons';

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
          maxWidth: '480px',
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
              העתקת סידור משבוע קודם
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

        <p
          style={{ fontSize: '0.875rem', color: '#4B5563', marginBottom: '20px', lineHeight: 1.5 }}
        >
          העתקת כל המשמרות מהשבוע הקודם (
          <strong style={{ color: '#D97706' }}>{formatDateDisplay(sourceWeekStartDate)}</strong>)
          לשבוע הנוכחי (
          <strong style={{ color: '#D97706' }}>{formatDateDisplay(targetWeekStartDate)}</strong>
          ).
        </p>

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
          onSubmit={handleCopy}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {/* Checkbox for copying assignments */}
          <div
            onClick={() => setCopyAssignments(!copyAssignments)}
            style={{
              backgroundColor: copyAssignments ? '#FFFBEB' : '#F9FAFB',
              border: copyAssignments
                ? '1.5px solid var(--ys-color-brand-yellow)'
                : '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '14px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ color: copyAssignments ? 'var(--ys-color-brand-yellow)' : '#9CA3AF' }}>
              {copyAssignments ? <CheckSquareIcon size={20} /> : <SquareIcon size={20} />}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>
                העתק גם שיבוצי עובדים
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '2px' }}>
                רק עובדים שעדיין פעילים בתחנה ישובצו. עובדים שהושבתו ידולגו באופן בטוח.
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#FEFCE8',
              border: '1px solid #FEF08A',
              borderRadius: '6px',
              padding: '10px 14px',
              fontSize: '0.8125rem',
              color: '#854D0E',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <WarningIcon size={16} />
            <span>המשמרות יתווספו לסידור העבודה הנוכחי בסטטוס טיוטה (DRAFT).</span>
          </div>

          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}
          >
            <Button type="button" variant="secondary" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'מעתיק משמרות...' : 'אשר והעתק שבוע'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
