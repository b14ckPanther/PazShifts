'use client';

import { useState } from 'react';
import { Button } from '@yellowshifts/ui';
import { ShieldCheckIcon } from '@yellowshifts/icons';
import type { StationMemberWithProfile } from '@yellowshifts/types';
import { canManageMember } from '@yellowshifts/database';
import { RoleModal, StatusModal } from './MemberActionModals';
import { RemoveMemberButton } from './RemoveMemberButton';

export function MemberDetailsActions({
  stationId,
  member,
  currentUserId,
  isPlatformAdmin = false,
}: {
  stationId: string;
  member: StationMemberWithProfile;
  currentUserId: string;
  isPlatformAdmin?: boolean;
}) {
  const [modal, setModal] = useState<'role' | 'status' | null>(null);
  if (!canManageMember({ currentUserId, isPlatformAdmin, canManage: true }, member.membership)) {
    return (
      <div className="staff-protected">
        <ShieldCheckIcon size={18} />
        <span>
          {member.membership.userId === currentUserId ? 'זה החשבון שלך' : 'מנהל תחנה'}
          <small>ההרשאות מנוהלות על ידי מנהל המערכת הראשי</small>
        </span>
      </div>
    );
  }
  return (
    <div className="staff-actions">
      <Button variant="secondary" size="sm" onClick={() => setModal('role')}>
        שינוי תפקיד
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setModal('status')}>
        {member.membership.status === 'ACTIVE' ? 'עדכון גישה' : 'הפעלה מחדש'}
      </Button>
      {member.membership.status !== 'INACTIVE' && (
        <RemoveMemberButton
          stationId={stationId}
          membershipId={member.membership.id}
          memberName={member.profile.fullName || member.profile.email || 'איש הצוות'}
        />
      )}
      {modal === 'role' && (
        <RoleModal
          stationId={stationId}
          member={member}
          isOpen
          onClose={() => setModal(null)}
          isPlatformAdmin={isPlatformAdmin}
        />
      )}
      {modal === 'status' && (
        <StatusModal stationId={stationId} member={member} isOpen onClose={() => setModal(null)} />
      )}
    </div>
  );
}
