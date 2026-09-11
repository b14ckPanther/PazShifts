'use client';

import { useState, useTransition } from 'react';
import { Button } from '@yellowshifts/ui';
import type { AttendanceRecordWithDetails, StationMemberWithProfile } from '@yellowshifts/types';
import { StaffDialog } from './StaffDialog';
import { saveManualAttendanceAction } from '../actions/attendance';

function localTime(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
export function ManualAttendanceDialog({
  stationId,
  timezone,
  members,
  record,
  onClose,
  onSaved,
}: {
  stationId: string;
  timezone: string;
  members: StationMemberWithProfile[];
  record: AttendanceRecordWithDetails | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <StaffDialog
      title={record ? 'עריכת זמני נוכחות' : 'דיווח נוכחות ידני'}
      busy={pending}
      onClose={onClose}
    >
      <form
        className="manual-attendance-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setError('');
          startTransition(async () => {
            const result = await saveManualAttendanceAction({
              stationId,
              membershipId: record?.station_membership_id || String(form.get('membership')),
              recordId: record?.id || null,
              expectedUpdatedAt: record?.updated_at || null,
              clockIn: String(form.get('clockIn')),
              clockOut: String(form.get('clockOut') || '') || null,
              reason: String(form.get('reason')),
            });
            if (!result.success) {
              setError(result.error || 'לא ניתן לשמור את הדיווח.');
              return;
            }
            onSaved();
            onClose();
          });
        }}
      >
        {record ? (
          <p className="manual-worker-name">{record.user?.full_name || 'איש צוות'}</p>
        ) : (
          <label>
            איש צוות
            <select name="membership" required disabled={pending} defaultValue="">
              <option value="" disabled>
                בחירת עובד או מנהל
              </option>
              {members
                .filter((m) => m.membership.status === 'ACTIVE')
                .map((m) => (
                  <option key={m.membership.id} value={m.membership.id}>
                    {m.profile.fullName || m.profile.email}
                    {m.membership.role === 'ADMIN' ? ' · מנהל תחנה' : ''}
                  </option>
                ))}
            </select>
          </label>
        )}
        <p className="manual-timezone">השעות לפי אזור הזמן של התחנה: {timezone}</p>
        <label>
          כניסה
          <input
            name="clockIn"
            type="datetime-local"
            step="1"
            dir="ltr"
            required
            disabled={pending}
            defaultValue={localTime(record?.clock_in_at || new Date().toISOString(), timezone)}
          />
        </label>
        <label>
          יציאה
          <input
            name="clockOut"
            type="datetime-local"
            step="1"
            dir="ltr"
            disabled={pending}
            defaultValue={record?.clock_out_at ? localTime(record.clock_out_at, timezone) : ''}
          />
          <small>השאר ריק למשמרת שעדיין פעילה.</small>
        </label>
        <label>
          סיבת הדיווח או התיקון
          <textarea
            name="reason"
            required
            maxLength={1000}
            rows={2}
            disabled={pending}
            placeholder="למשל: תיקון שעת כניסה שלא דווחה"
          />
        </label>
        {error && (
          <p className="mobile-error" role="alert">
            {error}
          </p>
        )}
        <p className="manual-timezone">השינוי נשמר עם שמך, הסיבה והזמנים הקודמים לצורכי ביקורת.</p>
        <div className="staff-dialog-actions">
          <Button type="submit" isLoading={pending}>
            שמירת דיווח
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            ביטול
          </Button>
        </div>
      </form>
    </StaffDialog>
  );
}
