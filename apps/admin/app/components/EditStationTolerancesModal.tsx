'use client';

import React, { useId, useState, useTransition } from 'react';
import { Button, Alert, Dialog, Input } from '@yellowshifts/ui';
import { SettingsIcon } from '@yellowshifts/icons';
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
  const formId = useId();

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
      <Button
        variant="secondary"
        size="sm"
        onClick={handleOpen}
        rightIcon={<SettingsIcon size={16} aria-hidden="true" />}
      >
        עריכת הגדרות
      </Button>

      <Dialog
        open={isOpen}
        onClose={handleClose}
        dismissible={!isPending}
        title="הגדרות סבילות נוכחות"
        description={`הגדרות אלו קובעות את טווחי הזמנים שבהם דיווחי כניסה ויציאה נחשבים בזמן עבור ${station.name}.`}
        footer={
          <>
            <Button type="submit" form={formId} variant="primary" isLoading={isPending}>
              שמירת הגדרות
            </Button>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
              ביטול
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="tolerances-form">
          {error && (
            <Alert variant="danger" title="שגיאה בעדכון הגדרות">
              {error}
            </Alert>
          )}

          <Input
            id="allowedLateMinutes"
            name="allowedLateMinutes"
            type="number"
            inputMode="numeric"
            label="איחור מותר (דקות)"
            helperText="כניסה עד מספר דקות זה לאחר מועד המשמרת המתוכנן לא תסומן כאיחור (0-120)."
            min={0}
            max={120}
            value={allowedLateMinutes}
            onChange={(e) => setAllowedLateMinutes(Number(e.target.value))}
            disabled={isPending}
            isRequired
          />

          <Input
            id="allowedEarlyLeaveMinutes"
            name="allowedEarlyLeaveMinutes"
            type="number"
            inputMode="numeric"
            label="יציאה מוקדמת מותרת (דקות)"
            helperText="יציאה עד מספר דקות זה לפני סיום המשמרת לא תסומן כיציאה מוקדמת (0-120)."
            min={0}
            max={120}
            value={allowedEarlyLeaveMinutes}
            onChange={(e) => setAllowedEarlyLeaveMinutes(Number(e.target.value))}
            disabled={isPending}
            isRequired
          />

          <Input
            id="leftOpenWarningHours"
            name="leftOpenWarningHours"
            type="number"
            inputMode="numeric"
            label="התראת משמרת פתוחה (שעות)"
            helperText="משמרת פעילה מעבר למספר שעות זה ללא דיווח יציאה תסומן כחריגה פתוחה (1-48)."
            min={1}
            max={48}
            value={leftOpenWarningHours}
            onChange={(e) => setLeftOpenWarningHours(Number(e.target.value))}
            disabled={isPending}
            isRequired
          />
        </form>
      </Dialog>
    </>
  );
};
