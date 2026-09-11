'use client';

import React, { useState, useEffect, useTransition } from 'react';
import type { ScheduleValidationResult } from '@yellowshifts/types';
import { validateScheduleAction, updateScheduleStatusAction } from '../actions/schedules';
import { Button, Spinner, Badge } from '@yellowshifts/ui';
import { CloseIcon, SendIcon, WarningIcon, SuccessIcon } from '@yellowshifts/icons';

interface PublishValidationModalProps {
  stationId: string;
  scheduleId: string;
  weekStartDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PublishValidationModal({
  stationId,
  scheduleId,
  weekStartDate: _weekStartDate,
  onClose,
  onSuccess,
}: PublishValidationModalProps) {
  const [validation, setValidation] = useState<ScheduleValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isPublishing, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function runCheck() {
      setIsValidating(true);
      const res = await validateScheduleAction(stationId, scheduleId);
      if (!isMounted) return;

      if (res.success && res.validation) {
        setValidation(res.validation);
      } else {
        setValidationError(res.error || 'שגיאה בבדיקת תקינות הסידור');
      }
      setIsValidating(false);
    }

    runCheck();

    return () => {
      isMounted = false;
    };
  }, [stationId, scheduleId]);

  const handleConfirmPublish = () => {
    startTransition(async () => {
      const res = await updateScheduleStatusAction(stationId, scheduleId, 'PUBLISHED');
      if (res.success) {
        onSuccess();
      } else {
        setValidationError(res.error || 'שגיאה בפרסום סידור העבודה');
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
          maxWidth: '540px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          direction: 'rtl',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SendIcon size={20} style={{ color: 'var(--ys-color-brand-yellow)' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>
              בדיקת תקינות ופרסום סידור
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

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
          {isValidating ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>
              <Spinner size="lg" />
              <p style={{ marginTop: '16px', fontSize: '0.875rem' }}>
                מבצע בדיקת תקינות לסידור העבודה...
              </p>
            </div>
          ) : validationError ? (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                color: '#991B1B',
                border: '1px solid #FECACA',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.875rem',
              }}
            >
              {validationError}
            </div>
          ) : validation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Hard Errors */}
              {validation.errors.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '8px',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#DC2626',
                      fontWeight: 700,
                      marginBottom: '8px',
                    }}
                  >
                    <WarningIcon size={18} />
                    <span>שגיאות המונעות פרסום</span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingRight: '20px',
                      color: '#B91C1C',
                      fontSize: '0.875rem',
                    }}
                  >
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clean Bill of Health */}
              {validation.errors.length === 0 && validation.warnings.length === 0 && (
                <div
                  style={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <SuccessIcon size={24} style={{ color: '#16A34A', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.9375rem' }}>
                      הסידור נבדק בהצלחה וללא אזהרות
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#15803D', marginTop: '2px' }}>
                      סך הכל {validation.totalShifts} משמרות עם {validation.totalAssignments} שיבוצי
                      צוות. מוכן לפרסום רשמי.
                    </div>
                  </div>
                </div>
              )}

              {/* Operational Warnings */}
              {validation.warnings.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#FEFCE8',
                    border: '1px solid #FEF08A',
                    borderRadius: '8px',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#854D0E',
                        fontWeight: 700,
                      }}
                    >
                      <WarningIcon size={18} />
                      <span>אזהרות תפעוליות ({validation.warnings.length})</span>
                    </div>
                    <Badge variant="warning">לתשומת לב</Badge>
                  </div>

                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: '#713F12',
                      margin: '0 0 12px 0',
                      lineHeight: 1.4,
                    }}
                  >
                    נמצאו אי-התאמות תפעוליות. ניתן לפרסם את הסידור בכל זאת אם מדובר במצב מכוון.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      maxHeight: '180px',
                      overflowY: 'auto',
                    }}
                  >
                    {validation.warnings.map((w, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E5E7EB',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '0.8125rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#6B7280' }}>{w.shiftDate}</span>
                          <span style={{ fontWeight: 600, color: '#111827' }}>
                            {w.templateName || 'משמרת מותאמת'} ({w.startTime}-{w.endTime})
                          </span>
                        </div>
                        <Badge variant="neutral" style={{ fontSize: '0.6875rem' }}>
                          {w.type === 'no_workers' ? 'ללא עובדים' : 'ללא מנהל'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Publication Notice */}
              <div style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>
                לאחר הפרסום, סידור העבודה הופך לרשמי ויוצג לכלל עובדי התחנה בממשק שלהם. ניתן להחזיר
                סידור לטיוטה בכל עת לצורך עריכה.
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPublishing}>
            ביטול
          </Button>

          <Button
            type="button"
            variant="primary"
            disabled={isValidating || !validation?.canPublish || isPublishing}
            onClick={handleConfirmPublish}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <SendIcon size={16} />
            <span>
              {isPublishing
                ? 'מפרסם...'
                : validation && validation.warnings.length > 0
                  ? 'הבנתי, אשר ופרסם סידור'
                  : 'פרסם סידור עבודה'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
