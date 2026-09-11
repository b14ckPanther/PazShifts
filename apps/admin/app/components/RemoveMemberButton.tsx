'use client';

import React, { useTransition } from 'react';
import { Button, Spinner } from '@yellowshifts/ui';
import { TrashIcon } from '@yellowshifts/icons';
import { removeStationMemberAction } from '../actions/stations';

interface RemoveMemberButtonProps {
  stationId: string;
  membershipId: string;
  memberName: string;
}

export const RemoveMemberButton: React.FC<RemoveMemberButtonProps> = ({
  stationId,
  membershipId,
  memberName,
}) => {
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    const confirmed = window.confirm(
      `האם אתה בטוח שברצונך להסיר את הרשאת הגישה של "${memberName}" מתחנה זו?`
    );

    if (!confirmed) return;

    startTransition(async () => {
      const res = await removeStationMemberAction(stationId, membershipId);
      if (!res.success && res.error) {
        alert(res.error);
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      disabled={isPending}
      title="הסרת הרשאה"
      style={{
        color: 'var(--ys-color-status-danger)',
        padding: '6px 10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {isPending ? <Spinner size="sm" color="currentColor" /> : <TrashIcon size={15} />}
      <span>הסר</span>
    </Button>
  );
};
