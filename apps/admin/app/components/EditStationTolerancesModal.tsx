'use client';

import React, { useState, useTransition } from 'react';
import { Button, Alert, Input } from '@yellowshifts/ui';
import { SettingsIcon, CloseIcon } from '@yellowshifts/icons';
import type { Station } from '@yellowshifts/types';
import { updateStationTolerancesAction } from '../actions/stations';

interface EditStationTolerancesModalProps {
  station: Pick<
    Station,
    'id' | 'name' | 'allowedLateMinutes' | 'allowedEarlyLeaveMinutes' | 'leftOpenWarningHours'
  >;
}

export const EditStationTolerancesModal: React.FC<EditStationTolerancesModalProps> = ({
  station,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [allowedLateMinutes, setAllowedLateMinutes] = useState(station.allowedLateMinutes);
  const [allowedEarlyLeaveMinutes, setAllowedEarlyLeaveMinutes] = useState(
    station.allowedEarlyLeaveMinutes
  );
  const [leftOpenWarningHours, setLeftOpenWarningHours] = useState(station.leftOpenWarningHours);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setAllowedLateMinutes(station.allowedLateMinutes);
    setAllowedEarlyLeaveMinutes(station.allowedEarlyLeaveMinutes);
    setLeftOpenWarningHours(station.leftOpenWarningHours);
    setError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const late = Number(allowedLateMinutes);
    const early = Number(allowedEarlyLeaveMinutes);
    const openHours = Number(leftOpenWarningHours);

    if (isNaN(late) || late < 0 || late > 120) {
      setError('איחור מותר חייב להיות בין 0 ל-120 דקות.');
      return;
    }
    if (isNaN(early) || early < 0 || early > 120) {
      setError('יציאה מוקדמת מותרת חייבת להיות בין 0 ל-120 דקות.');
      return;
    }
    if (isNaN(openHours) || openHours < 1 || openHours > 48) {
      setError('שעות התראת משמרת פתוחה חייבות להיות בין שעה אחת ל-48 שעות.');
      return;
    }

    const formData = new FormData();
    formData.append('allowedLateMinutes', String(late));
    formData.append('allowedEarlyLeaveMinutes', String(early));
    formData.append('leftOpenWarningHours', String(openHours));

    startTransition(async () => {
      const result = await updateStationTolerancesAction(station.id, null, formData);
      if (result.success) {
        setIsOpen(false);
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <SettingsIcon size={14} />
          עריכת הגדרות
        </span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tolerances-modal-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
            direction: 'rtl',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 'var(--ys-radius-md)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SettingsIcon size={20} color="var(--ys-color-brand-yellow)" />
                <h3
                  id="tolerances-modal-title"
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#111827',
                    margin: 0,
                  }}
                >
                  הגדרות סבילות נוכחות
                </h3>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                aria-label="סגור חלון"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--ys-radius-sm)',
                }}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              הגדרות אלו קובעות את טווחי הזמנים שבהם דיווחי כניסה ויציאה נחשבים בזמן עבור{' '}
              {station.name}.
            </p>

            {error && (
              <Alert variant="danger" title="שגיאה בעדכון הגדרות">
                {error}
              </Alert>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <label
                  htmlFor="allowedLateMinutes"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  איחור מותר (דקות)
                </label>
                <Input
                  id="allowedLateMinutes"
                  name="allowedLateMinutes"
                  type="number"
                  min={0}
                  max={120}
                  value={allowedLateMinutes}
                  onChange={(e) => setAllowedLateMinutes(Number(e.target.value))}
                  disabled={isPending}
                  isRequired
                />
                <span
                  style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginTop: '4px' }}
                >
                  כניסה עד מספר דקות זה לאחר מועד המשמרת המתוכנן לא תסומן כאיחור (0-120).
                </span>
              </div>

              <div>
                <label
                  htmlFor="allowedEarlyLeaveMinutes"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  יציאה מוקדמת מותרת (דקות)
                </label>
                <Input
                  id="allowedEarlyLeaveMinutes"
                  name="allowedEarlyLeaveMinutes"
                  type="number"
                  min={0}
                  max={120}
                  value={allowedEarlyLeaveMinutes}
                  onChange={(e) => setAllowedEarlyLeaveMinutes(Number(e.target.value))}
                  disabled={isPending}
                  isRequired
                />
                <span
                  style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginTop: '4px' }}
                >
                  יציאה עד מספר דקות זה לפני סיום המשמרת לא תסומן כיציאה מוקדמת (0-120).
                </span>
              </div>

              <div>
                <label
                  htmlFor="leftOpenWarningHours"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  התראת משמרת פתוחה (שעות)
                </label>
                <Input
                  id="leftOpenWarningHours"
                  name="leftOpenWarningHours"
                  type="number"
                  min={1}
                  max={48}
                  value={leftOpenWarningHours}
                  onChange={(e) => setLeftOpenWarningHours(Number(e.target.value))}
                  disabled={isPending}
                  isRequired
                />
                <span
                  style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginTop: '4px' }}
                >
                  משמרת פעילה מעבר למספר שעות זה ללא דיווח יציאה תסומן כחריגה פתוחה (1-48).
                </span>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '8px',
                }}
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  ביטול
                </Button>
                <Button type="submit" variant="primary" size="md" isLoading={isPending}>
                  שמירת הגדרות
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
