'use client';

import React, { useTransition } from 'react';
import { Button, Spinner } from '@yellowshifts/ui';
import { PowerIcon } from '@yellowshifts/icons';
import { toggleStationStatusAction } from '../actions/stations';

interface StationStatusToggleProps {
  stationId: string;
  isActive: boolean;
  stationName: string;
}

export const StationStatusToggle: React.FC<StationStatusToggleProps> = ({
  stationId,
  isActive,
  stationName,
}) => {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const actionText = isActive ? 'להשבית' : 'להפעיל מחדש';
    const confirmed = window.confirm(
      `האם אתה בטוח שברצונך ${actionText} את תחנת "${stationName}"?`
    );

    if (!confirmed) return;

    startTransition(async () => {
      await toggleStationStatusAction(stationId, isActive);
    });
  };

  return (
    <Button
      variant={isActive ? 'ghost' : 'secondary'}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      title={isActive ? 'השבתת תחנה' : 'הפעלת תחנה'}
      style={{
        color: isActive ? 'var(--ys-color-status-danger)' : 'var(--ys-color-status-success)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {isPending ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Spinner size="sm" color="currentColor" />
          מעדכן...
        </span>
      ) : (
        <>
          <PowerIcon size={14} />
          {isActive ? 'השבת תחנה' : 'הפעל תחנה'}
        </>
      )}
    </Button>
  );
};
