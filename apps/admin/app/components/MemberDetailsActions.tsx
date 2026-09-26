'use client';

import { useState } from 'react';
import { Button } from '@yellowshifts/ui';
import { ShieldCheckIcon, EditIcon, ChevronDownIcon } from '@yellowshifts/icons';
import type { StationMemberWithProfile } from '@yellowshifts/types';
import { canManageMember } from '@yellowshifts/database';
import { EditWorkerProfileModal } from './EditWorkerProfileModal';
import { RoleModal, StatusModal } from './MemberActionModals';
import { RemoveMemberButton } from './RemoveMemberButton';

/**
 * Member actions. `row` (staff directory): edit plus a collapsed permissions section.
 * `panel` (member profile): the same actions grouped, with ending access set apart.
 */
export function MemberDetailsActions({
  stationId,
  member,
  currentUserId,
  isPlatformAdmin = false,
  layout = 'row',
}: {
  stationId: string;
  member: StationMemberWithProfile;
  currentUserId: string;
  isPlatformAdmin?: boolean;
  layout?: 'row' | 'panel';
}) {
  const [modal, setModal] = useState<'role' | 'status' | 'profile' | null>(null);
  if (!canManageMember({ currentUserId, isPlatformAdmin, canManage: true }, member.membership)) {
    return (
      <div className="staff-protected">
        <ShieldCheckIcon size={18} aria-hidden="true" />
        <span>
          {member.membership.userId === currentUserId ? 'זה החשבון שלך' : 'מנהל תחנה'}
          <small>שינוי הרשאות: מנהל המערכת בלבד</small>
        </span>
      </div>
    );
  }

  const editButton = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      rightIcon={<EditIcon size={16} />}
      onClick={() => setModal('profile')}
    >
      עריכת פרטים
    </Button>
  );
  const permissionButtons = (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setModal('role')}>
        שינוי תפקיד
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => setModal('status')}>
        {member.membership.status === 'ACTIVE' ? 'עדכון גישה' : 'הפעלה מחדש'}
      </Button>
    </>
  );
  const removeButton = member.membership.status !== 'INACTIVE' && (
    <RemoveMemberButton
      stationId={stationId}
      membershipId={member.membership.id}
      memberName={member.profile.fullName || member.profile.email || 'איש הצוות'}
    />
  );
  const dialogs = (
    <>
      {modal === 'profile' && (
        <EditWorkerProfileModal
          stationId={stationId}
          member={member}
          onClose={() => setModal(null)}
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
    </>
  );

  if (layout === 'panel') {
    return (
      <div className="staff-action-panel">
        <div className="staff-action-group">
          <h3 className="staff-action-group-title">פרטים אישיים</h3>
          <div className="staff-action-buttons">{editButton}</div>
        </div>
        <div className="staff-action-group">
          <h3 className="staff-action-group-title">הרשאות וגישה</h3>
          <div className="staff-action-buttons">{permissionButtons}</div>
        </div>
        {removeButton && (
          <div className="staff-action-group staff-action-group--danger">
            <h3 className="staff-action-group-title">סיום גישה לתחנה</h3>
            <p className="staff-action-group-text">
              ההיסטוריה נשמרת, וניתן להפעיל את הגישה מחדש בכל עת.
            </p>
            <div className="staff-action-buttons">{removeButton}</div>
          </div>
        )}
        {dialogs}
      </div>
    );
  }

  return (
    <div className="staff-actions">
      {editButton}
      <details className="staff-more">
        <summary>
          הרשאות וגישה
          <ChevronDownIcon size={16} aria-hidden="true" className="staff-more-chevron" />
        </summary>
        <div className="staff-more-content">
          {permissionButtons}
          {removeButton && <span className="staff-more-divider" aria-hidden="true" />}
          {removeButton}
        </div>
      </details>
      {dialogs}
    </div>
  );
}
