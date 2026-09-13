'use client';

import React, { useState, useEffect, useTransition } from 'react';
import type { ShiftTemplate } from '@yellowshifts/types';
import { createScheduledShiftAction } from '../actions/schedules';
import { Button, Badge } from '@yellowshifts/ui';
import { ClockIcon, MoonIcon, SunIcon, CloseIcon } from '@yellowshifts/icons';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
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
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>
              הוספת משמרת חדשה
            </h3>
            <span
              style={{
                fontSize: '0.875rem',
                color: '#D97706',
                fontWeight: 600,
              }}
            >
              {getHebrewDayName(shiftDate)} • {formatDateDisplay(shiftDate)}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '0.875rem',
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
          {/* Template Selection */}
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
              תבנית משמרת (אופציונלי)
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
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
              <option value="">משמרת מותאמת אישית (ללא תבנית)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({`\u2066${t.startTime} — ${t.endTime}\u2069`})
                </option>
              ))}
            </select>
          </div>

          {/* Start and End Times */}
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
                dir="ltr"
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
                dir="ltr"
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
                }}
              />
            </div>
          </div>

          {/* Overnight Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F9FAFB',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClockIcon size={16} style={{ color: 'var(--ys-color-brand-yellow)' }} />
              <span style={{ fontSize: '0.875rem', color: '#374151' }}>משך ואופי משמרת:</span>
            </div>
            {overnight ? (
              <Badge
                variant="warning"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <MoonIcon size={12} />
                <span>לילה (מסתיים למחרת)</span>
              </Badge>
            ) : (
              <Badge
                variant="neutral"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <SunIcon size={12} />
                <span>יום</span>
              </Badge>
            )}
          </div>

          {/* Notes */}
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
              הערות והנחיות למשמרת (אופציונלי)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="למשל: דגש על בדיקת ניקיון משאבות..."
              style={{
                width: '100%',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                padding: '10px 12px',
                color: '#111827',
                fontSize: '0.9375rem',
                resize: 'none',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
            }}
          >
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              ביטול
            </Button>
            <Button type="submit" variant="primary" disabled={isPending} isLoading={isPending}>
              הוסף משמרת לסידור
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
