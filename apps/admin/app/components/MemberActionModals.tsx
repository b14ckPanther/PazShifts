'use client';

import { useState, useTransition } from 'react';
import { Button, Alert } from '@yellowshifts/ui';
import type { StationRole, MembershipStatus, StationMemberWithProfile } from '@yellowshifts/types';
import { updateMemberRoleAction, updateMemberStatusAction } from '../actions/stations';
import { StaffDialog } from './StaffDialog';

interface Props {
  stationId: string;
  member: StationMemberWithProfile;
  isOpen: boolean;
  onClose: () => void;
  isPlatformAdmin?: boolean;
}

const roles = [
  { value: 'WORKER', title: 'עובד', description: 'דיווח נוכחות וצפייה במשמרות האישיות' },
  { value: 'SHIFT_MANAGER', title: 'מנהל משמרת', description: 'ניהול ושיבוץ משמרות לצוות התחנה' },
  { value: 'ADMIN', title: 'מנהל תחנה', description: 'ניהול תפעול התחנה והצוות' },
] as const;

export function RoleModal({ stationId, member, isOpen, onClose, isPlatformAdmin = false }: Props) {
  const [role, setRole] = useState<StationRole>(member.membership.role);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!isOpen) return null;
  return (
    <StaffDialog title="שינוי תפקיד בצוות" onClose={onClose} busy={pending}>
      <p className="staff-dialog-description">
        בחרו את התפקיד של <strong>{member.profile.fullName}</strong> בתחנה.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              const result = await updateMemberRoleAction(stationId, member.membership.id, role);
              if (result.success) onClose();
              else setError(result.error || 'לא ניתן לעדכן את התפקיד. נסו שוב.');
            } catch {
              setError('העדכון לא הושלם. בדקו את החיבור ונסו שוב.');
            }
          });
        }}
      >
        <fieldset className="staff-role-options" disabled={pending}>
          <legend className="staff-sr-only">תפקיד בתחנה</legend>
          {roles
            .filter((item) => isPlatformAdmin || item.value !== 'ADMIN')
            .map((item) => (
              <label className="staff-role-option" key={item.value}>
                <input
                  type="radio"
                  name="role"
                  value={item.value}
                  checked={role === item.value}
                  onChange={() => setRole(item.value)}
                />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </label>
            ))}
        </fieldset>
        {error && <Alert variant="danger">{error}</Alert>}
        <footer className="staff-dialog-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
          <Button type="submit" disabled={pending || role === member.membership.role}>
            {pending ? 'שומר…' : 'שמירת תפקיד'}
          </Button>
        </footer>
      </form>
    </StaffDialog>
  );
}

export function StatusModal({ stationId, member, isOpen, onClose }: Props) {
  const [status, setStatus] = useState<MembershipStatus>(member.membership.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!isOpen) return null;
  return (
    <StaffDialog title="עדכון גישה לתחנה" onClose={onClose} busy={pending}>
      <p className="staff-dialog-description">
        עדכון הגישה של <strong>{member.profile.fullName}</strong>. הנוכחות והמשמרות הקודמות נשמרות
        בכל מצב.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              const result = await updateMemberStatusAction(
                stationId,
                member.membership.id,
                status
              );
              if (result.success) onClose();
              else setError(result.error || 'לא ניתן לעדכן את הגישה. נסו שוב.');
            } catch {
              setError('העדכון לא הושלם. בדקו את החיבור ונסו שוב.');
            }
          });
        }}
      >
        <fieldset className="staff-role-options" disabled={pending}>
          <legend className="staff-sr-only">מצב הגישה</legend>
          {(
            [
              { value: 'ACTIVE', title: 'פעיל', description: 'גישה לפעילות התחנה בהתאם לתפקיד' },
              {
                value: 'INACTIVE',
                title: 'לא פעיל',
                description: 'סיום הגישה לתחנה, ללא מחיקת היסטוריה',
              },
              { value: 'SUSPENDED', title: 'מושעה', description: 'עצירת הגישה באופן זמני' },
            ] as const
          ).map((item) => (
            <label className="staff-role-option" key={item.value}>
              <input
                type="radio"
                name="status"
                checked={status === item.value}
                onChange={() => setStatus(item.value)}
              />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <Alert variant="danger">{error}</Alert>}
        <footer className="staff-dialog-footer">
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" disabled={pending || status === member.membership.status}>
            {pending ? 'שומר…' : 'שמירת שינוי'}
          </Button>
        </footer>
      </form>
    </StaffDialog>
  );
}
