'use client';

import React, { useState, useTransition } from 'react';
import { Button, Input, Alert, Dialog } from '@yellowshifts/ui';
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
  const [isOpen, setIsOpen] = useState(false);
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

  const roleOptions = (
    [
      { value: 'WORKER', title: 'עובד', description: 'נוכחות ומשמרות אישיות' },
      { value: 'SHIFT_MANAGER', title: 'מנהל משמרת', description: 'ניהול ושיבוץ משמרות' },
      { value: 'ADMIN', title: 'מנהל תחנה', description: 'ניהול תפעול התחנה והצוות' },
    ] as const
  ).filter((item) => isPlatformAdmin || item.value !== 'ADMIN');

  return (
    <>
      <Button
        type="button"
        variant="primary"
        rightIcon={<UserPlusIcon size={18} />}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        הוספת איש צוות
      </Button>
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        dismissible={!isPending}
        size="lg"
        className="staff-add-dialog"
        title={isPlatformAdmin ? 'הוספת איש צוות או מנהל תחנה' : 'הוספת עובד או מנהל משמרת'}
        description={
          tab === 'NEW'
            ? 'הזן את פרטי העובד החדש (שם, אימייל וסיסמה ראשונית) כדי ליצור עבורו חשבון ולהקצות אותו לתחנה זו מיידית.'
            : 'בחר משתמש רשום מתוך המערכת או הזן את כתובת האימייל שלו כדי להקצותו לתחנה זו.'
        }
      >
        <div className="staff-add-body">
          <div className="ys-segmented staff-add-mode" role="group" aria-label="סוג ההוספה">
            <button
              type="button"
              aria-pressed={tab === 'NEW'}
              onClick={() => {
                setTab('NEW');
                setErrorMessage(null);
              }}
            >
              יצירת חשבון חדש
            </button>
            <button
              type="button"
              aria-pressed={tab === 'EXISTING'}
              onClick={() => {
                setTab('EXISTING');
                setErrorMessage(null);
              }}
            >
              משתמש קיים במערכת
            </button>
          </div>

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
            className="staff-add-form"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleManualSubmit();
            }}
          >
            {/* TAB 1: NEW USER */}
            {tab === 'NEW' && (
              <fieldset className="ys-fieldset">
                <legend>פרטי החשבון החדש</legend>
                <div className="ys-form-grid">
                  <Input
                    id="new-user-fullname"
                    label="שם מלא"
                    isRequired
                    type="text"
                    placeholder="לדוגמה: יוסי כהן"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    required
                  />
                  <Input
                    id="new-user-email"
                    label="כתובת אימייל"
                    isRequired
                    type="email"
                    dir="ltr"
                    placeholder="yossi@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                  <Input
                    id="new-user-phone"
                    label="טלפון לכניסה (אופציונלי)"
                    type="tel"
                    dir="ltr"
                    placeholder="050-1234567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                  <Input
                    id="new-user-password"
                    label="סיסמה ראשונית"
                    isRequired
                    type="password"
                    placeholder="לפחות 8 תווים"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </fieldset>
            )}

            {/* TAB 2: EXISTING USER */}
            {tab === 'EXISTING' && (
              <fieldset className="ys-fieldset">
                <legend>בחירת משתמש קיים</legend>
                <div className="ys-form-grid">
                  <div className="ys-form-field">
                    <label htmlFor="assign-user-select" className="ys-label">
                      בחירת משתמש קיים מהרשימה
                    </label>
                    <select
                      id="assign-user-select"
                      value={selectedUserId}
                      onChange={(e) => {
                        setSelectedUserId(e.target.value);
                        if (e.target.value) setCustomEmail('');
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

                  <Input
                    id="assign-user-email"
                    label="או חיפוש לפי אימייל"
                    type="email"
                    dir="ltr"
                    placeholder="user@example.com"
                    value={customEmail}
                    disabled={Boolean(selectedUserId)}
                    onChange={(e) => {
                      setCustomEmail(e.target.value);
                      if (e.target.value) setSelectedUserId('');
                    }}
                  />
                </div>
              </fieldset>
            )}

            {/* ROLE & EMPLOYEE CODE */}
            <fieldset className="ys-fieldset">
              <legend>תפקיד ושיוך לתחנה</legend>
              <fieldset
                className="staff-role-options staff-role-options--inline"
                disabled={isPending}
              >
                <legend className="ys-label">
                  תפקיד בתחנה
                  <span className="ys-label-required" aria-hidden="true">
                    *
                  </span>
                </legend>
                {roleOptions.map((item) => (
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
              <div className="ys-form-grid">
                <Input
                  id="assign-user-code"
                  label="קוד עובד בתחנה (אופציונלי)"
                  type="text"
                  placeholder="לדוגמה: EMP-101"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                />
              </div>
            </fieldset>

            <div className="ys-form-actions">
              <Button
                type="button"
                variant="primary"
                onClick={handleManualSubmit}
                isLoading={isPending}
                rightIcon={<PlusIcon size={16} />}
              >
                {tab === 'NEW' ? 'צור משתמש והקצה לתחנה' : 'הקצה משתמש לתחנה'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
};
