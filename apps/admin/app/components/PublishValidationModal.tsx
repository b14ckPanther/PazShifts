'use client';

import React, { useState, useEffect, useTransition } from 'react';
import type { ScheduleValidationResult } from '@yellowshifts/types';
import { countText } from './WeeklyScheduleGrid';
import { validateScheduleAction, updateScheduleStatusAction } from '../actions/schedules';
import { Button, Spinner, Badge, Dialog } from '@yellowshifts/ui';
import { SendIcon, WarningIcon, SuccessIcon } from '@yellowshifts/icons';

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
    <Dialog
      open
      onClose={onClose}
      dismissible={!isPublishing}
      size="lg"
      title="בדיקת תקינות ופרסום סידור"
      footer={
        <>
          <Button
            type="button"
            variant="primary"
            disabled={isValidating || !validation?.canPublish || isPublishing}
            onClick={handleConfirmPublish}
            rightIcon={<SendIcon size={17} />}
          >
            {isPublishing
              ? 'מפרסם...'
              : validation && validation.warnings.length > 0
                ? 'הבנתי, אשר ופרסם סידור'
                : 'פרסם סידור עבודה'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPublishing}>
            ביטול
          </Button>
        </>
      }
    >
      <div className="schedule-validation" aria-live="polite">
        {isValidating ? (
          <div className="schedule-validation-loading" role="status">
            <Spinner size="lg" />
            <p>מבצע בדיקת תקינות לסידור העבודה...</p>
          </div>
        ) : validationError ? (
          <p className="admin-feedback admin-feedback--error" role="alert">
            <WarningIcon size={18} aria-hidden="true" />
            <span>{validationError}</span>
          </p>
        ) : validation ? (
          <>
            {/* Hard errors */}
            {validation.errors.length > 0 && (
              <div className="schedule-validation-block is-error" role="alert">
                <p className="schedule-validation-title">
                  <span>
                    <WarningIcon size={18} aria-hidden="true" />
                    שגיאות המונעות פרסום
                  </span>
                </p>
                <ul>
                  {validation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clean bill of health */}
            {validation.errors.length === 0 && validation.warnings.length === 0 && (
              <div className="schedule-validation-block is-ok">
                <p className="schedule-validation-title">
                  <span>
                    <SuccessIcon size={20} aria-hidden="true" />
                    הסידור נבדק בהצלחה וללא אזהרות
                  </span>
                </p>
                <p>
                  סך הכל {countText(validation.totalShifts, 'משמרת אחת', 'משמרות')} עם{' '}
                  {countText(validation.totalAssignments, 'שיבוץ צוות אחד', 'שיבוצי צוות')}. מוכן
                  לפרסום רשמי.
                </p>
              </div>
            )}

            {/* Operational warnings */}
            {validation.warnings.length > 0 && (
              <div className="schedule-validation-block is-warning">
                <p className="schedule-validation-title">
                  <span>
                    <WarningIcon size={18} aria-hidden="true" />
                    אזהרות תפעוליות (<span className="ys-num">{validation.warnings.length}</span>)
                  </span>
                  <Badge variant="warning">לתשומת לב</Badge>
                </p>
                <p>נמצאו אי-התאמות תפעוליות. ניתן לפרסם את הסידור בכל זאת אם מדובר במצב מכוון.</p>
                <ul className="schedule-validation-warnings" aria-label="משמרות עם אזהרות">
                  {validation.warnings.map((w, idx) => (
                    <li key={idx} className="schedule-validation-warning">
                      <span className="schedule-validation-warning-text">
                        <bdi dir="ltr" className="schedule-validation-warning-date ys-num">
                          {w.shiftDate}
                        </bdi>
                        <strong>
                          {w.templateName || 'משמרת מותאמת'} (
                          <bdi dir="ltr" className="ys-num">{`${w.startTime}–${w.endTime}`}</bdi>)
                        </strong>
                      </span>
                      <Badge variant="neutral">
                        {w.type === 'no_workers' ? 'ללא עובדים' : 'ללא מנהל'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Publication notice */}
            <p className="schedule-dialog-note">
              לאחר הפרסום, סידור העבודה הופך לרשמי ויוצג לכלל עובדי התחנה בממשק שלהם. ניתן להחזיר
              סידור לטיוטה בכל עת לצורך עריכה.
            </p>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
