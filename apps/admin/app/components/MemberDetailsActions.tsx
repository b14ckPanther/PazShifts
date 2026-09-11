'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@yellowshifts/ui';
import { EditIcon, PowerIcon, TrashIcon } from '@yellowshifts/icons';
import type { StationMemberWithProfile } from '@yellowshifts/types';
import { RoleModal, StatusModal } from './MemberActionModals';
import { removeStationMemberAction } from '../actions/stations';

interface MemberDetailsActionsProps {
  stationId: string;
  member: StationMemberWithProfile;
}

export const MemberDetailsActions: React.FC<MemberDetailsActionsProps> = ({
  stationId,
  member,
}) => {
  const router = useRouter();
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRemove = async () => {
    const confirmed = window.confirm(
      `האם אתה בטוח שברצונך להסיר את "${member.profile.fullName || member.profile.email}" מתחנה זו?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    const result = await removeStationMemberAction(stationId, member.membership.id);
    setIsDeleting(false);

    if (result.success) {
      router.push(`/stations/${stationId}/staff`);
    } else if (result.error) {
      alert(result.error);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <Button
        variant="secondary"
        size="md"
        onClick={() => setIsRoleModalOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        <EditIcon size={16} />
        <span>שינוי תפקיד</span>
      </Button>

      <Button
        variant="secondary"
        size="md"
        onClick={() => setIsStatusModalOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        <PowerIcon size={16} />
        <span>שינוי סטטוס</span>
      </Button>

      <Button
        variant="ghost"
        size="md"
        onClick={handleRemove}
        disabled={isDeleting}
        style={{
          color: 'var(--ys-color-status-danger)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <TrashIcon size={16} />
        <span>הסרת איש צוות מהתחנה</span>
      </Button>

      {isRoleModalOpen && (
        <RoleModal
          stationId={stationId}
          member={member}
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
        />
      )}

      {isStatusModalOpen && (
        <StatusModal
          stationId={stationId}
          member={member}
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
        />
      )}
    </div>
  );
};
