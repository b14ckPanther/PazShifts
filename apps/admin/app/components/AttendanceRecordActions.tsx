'use client';
import { useRef, useState } from 'react';
import { Button } from '@yellowshifts/ui';
import { ClockIcon, TrashIcon, EditIcon } from '@yellowshifts/icons';
import type { AttendanceRecordWithDetails } from '@yellowshifts/types';
import { StaffDialog } from './StaffDialog';
import { manageAttendanceRecordAction } from '../actions/attendance';

export function AttendanceRecordActions({
  record,
  onSaved,
  onEdit,
}: {
  record: AttendanceRecordWithDetails;
  onSaved: () => void;
  onEdit?: () => void;
}) {
  const [action, setAction] = useState<'CLOSE' | 'DELETE' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  return (
    <>
      <div className="attendance-card-actions-group">
        <div className="attendance-card-primary-actions">
          {onEdit && (
            <Button
              variant="secondary"
              size="sm"
              className="attendance-btn-edit"
              onClick={onEdit}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <EditIcon size={14} />
                <span>עריכת זמנים</span>
              </span>
            </Button>
          )}
          {record.status === 'ACTIVE' && (
            <Button
              variant="primary"
              size="sm"
              className="attendance-btn-close"
              onClick={() => {
                setError('');
                setAction('CLOSE');
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ClockIcon size={14} />
                <span>סיום משמרת עכשיו</span>
              </span>
            </Button>
          )}
        </div>

        <button
          type="button"
          className="attendance-btn-delete"
          onClick={() => {
            setError('');
            setAction('DELETE');
          }}
        >
          <TrashIcon size={13} />
          <span>מחיקת דיווח שגוי</span>
        </button>
      </div>

      {action && (
        <StaffDialog
          title={action === 'DELETE' ? 'מחיקת דיווח שגוי' : 'סיום משמרת עכשיו'}
          busy={pending}
          onClose={() => setAction(null)}
        >
          <form
            className="manual-attendance-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (locked.current) return;
              const reason = String(new FormData(event.currentTarget).get('reason') || '');
              locked.current = true;
              setPending(true);
              setError('');
              try {
                const result = await manageAttendanceRecordAction({
                  stationId: record.station_id,
                  recordId: record.id,
                  action,
                  reason,
                  expectedUpdatedAt: record.updated_at,
                });
                if (!result.success) {
                  setError(result.error || 'הפעולה נכשלה.');
                  return;
                }
                setAction(null);
                onSaved();
              } catch {
                setError('לא התקבל אישור מהשרת. רעננו את הרשימה לפני ניסיון נוסף.');
              } finally {
                locked.current = false;
                setPending(false);
              }
            }}
          >
            <p>
              <strong>{record.user?.full_name || 'איש צוות'}</strong>
            </p>
            <p>
              {action === 'DELETE'
                ? 'הדיווח יוסר מהנוכחות ומדוחות השעות, והטווח יתפנה לדיווח מתוקן. עותק ביקורת והסיבה יישמרו. לא ניתן לבטל מחיקה דרך מסך זה.'
                : 'המשמרת תסתיים לפי שעת השרת הנוכחית. לעריכת שעת יציאה אחרת השתמשו בעריכת זמנים.'}
            </p>
            <label>
              סיבה
              <textarea name="reason" required maxLength={1000} rows={3} disabled={pending} />
            </label>
            {error && (
              <p role="alert" className="mobile-error">
                {error}
              </p>
            )}
            <div className="staff-dialog-actions">
              <Button
                type="submit"
                variant={action === 'DELETE' ? 'destructive' : 'primary'}
                isLoading={pending}
              >
                {action === 'DELETE' ? 'אישור מחיקת הדיווח' : 'אישור סיום משמרת'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setAction(null)}
              >
                ביטול
              </Button>
            </div>
          </form>
        </StaffDialog>
      )}
    </>
  );
}
