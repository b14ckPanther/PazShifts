'use client';

import { useState, useTransition } from 'react';
import { Button, Alert } from '@yellowshifts/ui';
import { removeStationMemberAction } from '../actions/stations';
import { StaffDialog } from './StaffDialog';

export function RemoveMemberButton({
  stationId,
  membershipId,
  memberName,
}: {
  stationId: string;
  membershipId: string;
  memberName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        סיום גישה
      </Button>
      {open && (
        <StaffDialog title="סיום גישה לתחנה" onClose={() => setOpen(false)} busy={pending}>
          <p className="staff-dialog-description">
            לסיים את הגישה של <strong>{memberName}</strong> לתחנה?
          </p>
          <div className="staff-preservation-note">
            איש הצוות יסומן כלא פעיל. דיווחי הנוכחות והמשמרות הקודמות נשמרים, וניתן להפעיל את הגישה
            מחדש בכל עת.
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <footer className="staff-dialog-footer">
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const result = await removeStationMemberAction(stationId, membershipId);
                    if (result.success) setOpen(false);
                    else setError(result.error || 'לא ניתן לסיים את הגישה. נסו שוב.');
                  } catch {
                    setError('השינוי לא הושלם. בדקו את החיבור ונסו שוב.');
                  }
                });
              }}
              isLoading={pending}
            >
              אישור סיום גישה
            </Button>
          </footer>
        </StaffDialog>
      )}
    </>
  );
}
