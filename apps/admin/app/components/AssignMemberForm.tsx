'use client';

import React, { useState, useTransition } from 'react';
import { Button, Input, Alert, Spinner } from '@yellowshifts/ui';
import { UserPlusIcon, PlusIcon } from '@yellowshifts/icons';
import type { UserProfile, StationRole } from '@yellowshifts/types';
import { assignStationMemberAction } from '../actions/stations';

interface AssignMemberFormProps {
  stationId: string;
  assignableUsers: UserProfile[];
  isPlatformAdmin?: boolean;
}

export const AssignMemberForm: React.FC<AssignMemberFormProps> = ({
  stationId,
  assignableUsers,
  isPlatformAdmin = false,
}) => {
  const [tab, setTab] = useState<'EXISTING' | 'NEW'>('NEW');

  // Existing User State
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');

  // New User State
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState<string>('');

  // Common State
  const [role, setRole] = useState<StationRole>('WORKER');
  const [employeeCode, setEmployeeCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleManualSubmit = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (tab === 'EXISTING') {
      const email = customEmail.trim().toLowerCase();
      if (!selectedUserId && !email) {
        setErrorMessage('נא לבחור משתמש מהרשימה או להזין כתובת אימייל.');
        return;
      }

      startTransition(async () => {
        const result = await assignStationMemberAction({
          stationId,
          userId: selectedUserId || undefined,
          userEmail: email || undefined,
          role,
          employeeCode: employeeCode.trim() || null,
          createNewUser: false,
        });

        if (result.success) {
          setSuccessMessage('המשתמש הוקצה לתחנה בהצלחה.');
          setSelectedUserId('');
          setCustomEmail('');
          setEmployeeCode('');
        } else if (result.error) {
          setErrorMessage(result.error);
        }
      });
    } else {
      // NEW USER
      const name = newFullName.trim();
      const email = newEmail.trim().toLowerCase();
      const pwd = newPassword;

      if (!name || name.length < 2) {
        setErrorMessage('נא להזין שם מלא עבור העובד (לפחות 2 תווים).');
        return;
      }
      if (!email || !email.includes('@')) {
        setErrorMessage('נא להזין כתובת אימייל תקינה.');
        return;
      }
      if (!pwd || pwd.length < 8) {
        setErrorMessage('נא להזין סיסמה בת 8 תווים לפחות.');
        return;
      }

      startTransition(async () => {
        const result = await assignStationMemberAction({
          stationId,
          userEmail: email,
          fullName: name,
          phone: newPhone,
          password: pwd,
          role,
          employeeCode: employeeCode.trim() || null,
          createNewUser: true,
        });

        if (result.success) {
          setSuccessMessage(`המשתמש "${name}" (${email}) נוצר והוקצה לתחנה בהצלחה!`);
          setNewFullName('');
          setNewEmail('');
          setNewPassword('');
          setNewPhone('');
          setEmployeeCode('');
        } else if (result.error) {
          setErrorMessage(result.error);
        }
      });
    }
  };

  return (
    <details className="staff-add">
      <summary>＋ הוספת איש צוות לתחנה</summary>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 'var(--ys-radius-md)',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlusIcon size={20} color="var(--ys-color-brand-yellow)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#111827' }}>
              {isPlatformAdmin ? 'הוספת איש צוות או מנהל תחנה' : 'הוספת עובד או מנהל משמרת'}
            </h3>
          </div>

          {/* Tab Selector */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#F3F4F6',
              borderRadius: 'var(--ys-radius-sm)',
              padding: '3px',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setTab('NEW');
                setErrorMessage(null);
              }}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: 'var(--ys-radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tab === 'NEW' ? '#FFFFFF' : 'transparent',
                color: tab === 'NEW' ? '#111827' : '#6B7280',
                boxShadow: tab === 'NEW' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              יצירת חשבון חדש
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('EXISTING');
                setErrorMessage(null);
              }}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: 'var(--ys-radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tab === 'EXISTING' ? '#FFFFFF' : 'transparent',
                color: tab === 'EXISTING' ? '#111827' : '#6B7280',
                boxShadow: tab === 'EXISTING' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              משתמש קיים במערכת
            </button>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
          {tab === 'NEW'
            ? 'הזן את פרטי העובד החדש (שם, אימייל וסיסמה ראשונית) כדי ליצור עבורו חשבון ולהקצות אותו לתחנה זו מיידית.'
            : 'בחר משתמש רשום מתוך המערכת או הזן את כתובת האימייל שלו כדי להקצותו לתחנה זו.'}
        </p>

        {errorMessage && (
          <Alert variant="danger" title="שגיאה בהקצאה">
            {errorMessage}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" title="הפעולה בוצעה בהצלחה">
            {successMessage}
          </Alert>
        )}

        <form
          method="POST"
          action="#"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleManualSubmit();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {/* TAB 1: NEW USER */}
          {tab === 'NEW' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                backgroundColor: '#F9FAFB',
                padding: '16px',
                borderRadius: 'var(--ys-radius-sm)',
                border: '1px solid #E5E7EB',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="new-user-fullname"
                  style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}
                >
                  שם מלא <span style={{ color: 'var(--ys-color-brand-crimson)' }}>*</span>
                </label>
                <Input
                  id="new-user-fullname"
                  type="text"
                  placeholder="לדוגמה: יוסי כהן"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="new-user-email"
                  style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}
                >
                  כתובת אימייל <span style={{ color: 'var(--ys-color-brand-crimson)' }}>*</span>
                </label>
                <Input
                  id="new-user-email"
                  type="email"
                  placeholder="yossi@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="new-user-phone">טלפון לכניסה (אופציונלי)</label>
                <input
                  id="new-user-phone"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="050-1234567"
                  dir="ltr"
                  style={{ width: '100%', minHeight: 44, fontSize: 16, marginBottom: 12 }}
                />
                <label
                  htmlFor="new-user-password"
                  style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}
                >
                  סיסמה ראשונית <span style={{ color: 'var(--ys-color-brand-crimson)' }}>*</span>
                </label>
                <Input
                  id="new-user-password"
                  type="password"
                  placeholder="לפחות 8 תווים"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* TAB 2: EXISTING USER */}
          {tab === 'EXISTING' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="assign-user-select"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
                >
                  בחירת משתמש קיים מהרשימה
                </label>
                <select
                  id="assign-user-select"
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    if (e.target.value) setCustomEmail('');
                  }}
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    borderRadius: 'var(--ys-radius-sm)',
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    color: '#111827',
                    fontSize: '14px',
                    outline: 'none',
                    direction: 'rtl',
                  }}
                >
                  <option value="">-- בחר משתמש מהמערכת --</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || 'משתמש ללא שם'}{' '}
                      {u.email ? `(${u.email})` : `[${u.id.slice(0, 8)}]`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="assign-user-email"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
                >
                  או חיפוש לפי אימייל
                </label>
                <Input
                  id="assign-user-email"
                  type="email"
                  placeholder="user@example.com"
                  value={customEmail}
                  disabled={Boolean(selectedUserId)}
                  onChange={(e) => {
                    setCustomEmail(e.target.value);
                    if (e.target.value) setSelectedUserId('');
                  }}
                />
              </div>
            </div>
          )}

          {/* ROLE & EMPLOYEE CODE */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                תפקיד בתחנה <span style={{ color: 'var(--ys-color-brand-crimson)' }}>*</span>
              </label>
              <fieldset className="staff-role-options" style={{ margin: 0 }} disabled={isPending}>
                <legend className="staff-sr-only">תפקיד בתחנה</legend>
                {(
                  [
                    { value: 'WORKER', title: 'עובד', description: 'נוכחות ומשמרות אישיות' },
                    {
                      value: 'SHIFT_MANAGER',
                      title: 'מנהל משמרת',
                      description: 'ניהול ושיבוץ משמרות',
                    },
                    { value: 'ADMIN', title: 'מנהל תחנה', description: 'ניהול תפעול התחנה והצוות' },
                  ] as const
                )
                  .filter((item) => isPlatformAdmin || item.value !== 'ADMIN')
                  .map((item) => (
                    <label className="staff-role-option" key={item.value}>
                      <input
                        type="radio"
                        name="assign-role"
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
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="assign-user-code"
                style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
              >
                קוד עובד בתחנה (אופציונלי)
              </label>
              <Input
                id="assign-user-code"
                type="text"
                placeholder="לדוגמה: EMP-101"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
            <Button
              type="button"
              variant="primary"
              onClick={handleManualSubmit}
              disabled={isPending}
              style={{ minWidth: '180px' }}
            >
              {isPending ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Spinner size="sm" color="var(--ys-color-text-primary)" />
                  מעבד נתונים...
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <PlusIcon size={16} />
                  {tab === 'NEW' ? 'צור משתמש והקצה לתחנה' : 'הקצה משתמש לתחנה'}
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
};
