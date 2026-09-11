'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { StationMemberWithProfile } from '@yellowshifts/types';
import { Button, Alert } from '@yellowshifts/ui';
import { StaffDialog } from './StaffDialog';
import { updateWorkerProfileAction } from '../actions/stations';

export function EditWorkerProfileModal({
  stationId,
  member,
  onClose,
}: {
  stationId: string;
  member: StationMemberWithProfile;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <StaffDialog title="עריכת פרטי איש צוות" onClose={onClose} busy={pending}>
      <p className="staff-dialog-description">
        הטלפון או האימייל משמשים לכניסה עם הסיסמה. ודאו שהמספר שייך לעובד לפני השמירה.
      </p>
      <form
        className="staff-profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setError('');
          startTransition(async () => {
            try {
              const result = await updateWorkerProfileAction(stationId, member.membership.id, form);
              if (result.success) {
                router.refresh();
                onClose();
              } else setError(result.error || 'העדכון לא נשמר.');
            } catch {
              setError('העדכון לא הושלם. נסו שוב.');
            }
          });
        }}
      >
        <fieldset disabled={pending}>
          <label>
            שם מלא
            <input
              name="fullName"
              defaultValue={member.profile.fullName}
              required
              minLength={2}
              maxLength={120}
              autoComplete="off"
            />
          </label>
          <label>
            אימייל
            <input
              name="email"
              type="email"
              dir="ltr"
              defaultValue={member.profile.email || ''}
              required
              autoComplete="off"
            />
          </label>
          <label>
            טלפון לכניסה
            <input
              name="phone"
              type="tel"
              dir="ltr"
              defaultValue={member.profile.phone || ''}
              placeholder="050-1234567"
              autoComplete="off"
            />
          </label>
          <label>
            קוד עובד בתחנה
            <input
              name="employeeCode"
              defaultValue={member.membership.employeeCode || ''}
              maxLength={64}
            />
          </label>
          <label>
            סיסמה חדשה (אופציונלי)
            <input
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              placeholder="השאירו ריק לשמירת הסיסמה הקיימת"
            />
          </label>
        </fieldset>
        {error && <Alert variant="danger">{error}</Alert>}
        <footer className="staff-dialog-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'שומר…' : 'שמירת פרטים'}
          </Button>
        </footer>
      </form>
    </StaffDialog>
  );
}
