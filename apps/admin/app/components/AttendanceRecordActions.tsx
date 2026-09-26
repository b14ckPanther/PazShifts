'use client';
import { useRef, useState } from 'react';
import { Button } from '@yellowshifts/ui';
import { EditIcon, PowerIcon, TrashIcon } from '@yellowshifts/icons';
import type { AttendanceRecordWithDetails } from '@yellowshifts/types';
import { StaffDialog } from './StaffDialog';
import { manageAttendanceRecordAction } from '../actions/attendance';

export function AttendanceRecordActions({
  record,
  onSaved,
  onEdit,
  layout = 'card',
}: {
  record: AttendanceRecordWithDetails;
  onSaved: () => void;
  onEdit?: () => void;
  /** `card`: full labels under a live card (short in the desktop list). `row`: short labels in a table row. */
  layout?: 'card' | 'row';
}) {
  const [action, setAction] = useState<'CLOSE' | 'DELETE' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const name = record.user?.full_name || 'איש צוות';
  return (
    <>
      <div className={`attendance-actions attendance-actions--${layout}`}>
        <div className="attendance-actions-main">
          {record.status === 'ACTIVE' && (
            <Button
              variant="primary"
              rightIcon={<PowerIcon size={16} />}
              onClick={() => {
                setError('');
                setAction('CLOSE');
              }}
            >
              סיום משמרת
              <span className="ys-visually-hidden"> של {name}</span>
            </Button>
          )}
          {onEdit && (
            <Button variant="secondary" rightIcon={<EditIcon size={16} />} onClick={onEdit}>
              <span className="att-label-long">עריכת זמנים</span>
              <span className="att-label-short">עריכה</span>
              <span className="ys-visually-hidden"> של {name}</span>
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="attendance-action-delete"
          rightIcon={<TrashIcon size={16} />}
          onClick={() => {
            setError('');
            setAction('DELETE');
          }}
        >
          <span className="att-label-long">מחיקת דיווח שגוי</span>
          <span className="att-label-short">מחיקה</span>
          <span className="ys-visually-hidden"> של {name}</span>
        </Button>
      </div>

      {action && (
        <StaffDialog
          title={action === 'DELETE' ? 'מחיקת דיווח שגוי' : 'סיום משמרת'}
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
            <p className="manual-worker-name">{name}</p>
            <p className="manual-attendance-text">
              {action === 'DELETE'
                ? 'הדיווח יוסר מהנוכחות ומדוחות השעות, והטווח יתפנה לדיווח מתוקן. עותק ביקורת והסיבה יישמרו. לא ניתן לבטל מחיקה דרך מסך זה.'
                : 'המשמרת תסתיים לפי שעת השרת הנוכחית. לעריכת שעת יציאה אחרת השתמשו בעריכת זמנים.'}
            </p>
            <label>
              סיבה
              <textarea name="reason" required maxLength={1000} rows={3} disabled={pending} />
            </label>
            {error && (
              <p role="alert" className="admin-feedback admin-feedback--error">
                <span>{error}</span>
              </p>
            )}
            <div className="ys-form-actions manual-attendance-actions">
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
