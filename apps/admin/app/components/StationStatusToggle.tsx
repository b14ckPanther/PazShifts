'use client';

import React, { useState, useTransition } from 'react';
import { Alert, Button, Dialog } from '@yellowshifts/ui';
import { PowerIcon } from '@yellowshifts/icons';
import { toggleStationStatusAction } from '../actions/stations';

interface StationStatusToggleProps {
  stationId: string;
  isActive: boolean;
  stationName: string;
  size?: 'sm' | 'md';
}

export const StationStatusToggle: React.FC<StationStatusToggleProps> = ({
  stationId,
  isActive,
  stationName,
  size = 'sm',
}) => {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionText = isActive ? 'להשבית' : 'להפעיל מחדש';

  const openConfirm = () => {
    setError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (isPending) return;
    setConfirmOpen(false);
    setError(null);
  };

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const result = await toggleStationStatusAction(stationId, isActive);
      if (result && result.success === false) {
        setError(result.error || 'שגיאה בשינוי סטטוס תחנה.');
        return;
      }
      setConfirmOpen(false);
    });
  };

  return (
    <>
      <Button
        variant={isActive ? 'destructiveOutline' : 'secondary'}
        size={size === 'sm' ? 'sm' : 'md'}
        onClick={openConfirm}
        disabled={isPending}
        isLoading={isPending}
        title={isActive ? 'השבתת תחנה' : 'הפעלת תחנה'}
        rightIcon={<PowerIcon size={16} aria-hidden="true" />}
      >
        {isActive ? 'השבת תחנה' : 'הפעל תחנה'}
      </Button>

      <Dialog
        open={confirmOpen}
        onClose={closeConfirm}
        dismissible={!isPending}
        title={isActive ? 'השבתת תחנה' : 'הפעלת תחנה'}
        description={`האם אתה בטוח שברצונך ${actionText} את תחנת "${stationName}"?`}
        footer={
          <>
            <Button
              type="button"
              variant={isActive ? 'destructive' : 'primary'}
              onClick={handleToggle}
              isLoading={isPending}
            >
              {isActive ? 'השבת תחנה' : 'הפעל תחנה'}
            </Button>
            <Button type="button" variant="secondary" onClick={closeConfirm} disabled={isPending}>
              ביטול
            </Button>
          </>
        }
      >
        {error && (
          <Alert variant="danger" title="שינוי הסטטוס נכשל">
            {error}
          </Alert>
        )}
      </Dialog>
    </>
  );
};
