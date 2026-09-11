'use client';

import React, { useState, useTransition } from 'react';
import type { ScheduledShiftWithDetails } from '@yellowshifts/types';
import { updateScheduledShiftTimesAction } from '../actions/schedules';
import { Button } from '@yellowshifts/ui';
import { CloseIcon, EditIcon, MoonIcon, SunIcon } from '@yellowshifts/icons';

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
            <EditIcon size={20} style={{ color: 'var(--ys-color-brand-yellow)' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>
              עריכת זמני משמרת
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

        <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '16px' }}>
          {shift.templateName ? `${shift.templateName} • ` : ''}תאריך: {shift.shiftDate}
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
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                שעת התחלה *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                style={{
                  width: '100%',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  color: '#111827',
                  fontSize: '0.9375rem',
                  direction: 'ltr',
                }}
              />
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
                שעת סיום *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                style={{
                  width: '100%',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  color: '#111827',
                  fontSize: '0.9375rem',
                  direction: 'ltr',
                }}
              />
            </div>
          </div>

          {isOvernight ? (
            <div
              style={{
                backgroundColor: '#FEFCE8',
                border: '1px solid #FEF08A',
                borderRadius: '6px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.8125rem',
                color: '#854D0E',
              }}
            >
              <MoonIcon size={16} />
              <span>משמרת לילה: מסתיימת ביום שלמחרת</span>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '6px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.8125rem',
                color: '#166534',
              }}
            >
              <SunIcon size={16} />
              <span>משמרת יום: מתחילה ומסתיימת באותו היום</span>
            </div>
          )}

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
              הערות למשמרת
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="לדוגמה: אחראי פתיחה / חפיפת עובד"
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

          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}
          >
            <Button type="button" variant="secondary" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
