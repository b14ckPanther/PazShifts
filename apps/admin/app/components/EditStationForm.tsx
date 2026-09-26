'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { Button, Input, Card, Alert } from '@yellowshifts/ui';
import { CheckIcon } from '@yellowshifts/icons';
import type { Station } from '@yellowshifts/types';
import { updateStationAction } from '../actions/stations';

interface EditStationFormProps {
  station: Station;
}

export const EditStationForm: React.FC<EditStationFormProps> = ({ station }) => {
  const router = useRouter();
  const [name, setName] = useState(station.name);
  const [address, setAddress] = useState(station.address ?? '');
  const [phone, setPhone] = useState(station.phone ?? '');
  const [timezone, setTimezone] = useState(station.timezone);
  const [isActive, setIsActive] = useState(station.isActive);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const nameInput = (form.elements.namedItem('name') as HTMLInputElement)?.value || '';
    const addressInput = (form.elements.namedItem('address') as HTMLInputElement)?.value || '';
    const phoneInput = (form.elements.namedItem('phone') as HTMLInputElement)?.value || '';
    const tzInput = (form.elements.namedItem('timezone') as HTMLSelectElement)?.value || '';
    const activeInput = (form.elements.namedItem('isActive') as HTMLInputElement)?.checked;

    const resolvedName = (name || nameInput).trim();
    const resolvedAddress = (address || addressInput).trim();
    const resolvedPhone = (phone || phoneInput).trim();
    const resolvedTz = (timezone || tzInput).trim() || 'Asia/Jerusalem';
    const resolvedIsActive = activeInput !== undefined ? activeInput : isActive;

    if (!resolvedName || resolvedName.length < 2) {
      setError('נא להזין שם תחנה תקין (לפחות 2 תווים).');
      return;
    }

    startTransition(async () => {
      const result = await updateStationAction(station.id, {
        name: resolvedName,
        address: resolvedAddress || null,
        phone: resolvedPhone || null,
        timezone: resolvedTz,
        isActive: resolvedIsActive,
      });
      if (result.success) {
        router.push(`/stations/${encodeURIComponent(station.code)}`);
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <Card className="station-form-card">
      <form onSubmit={handleSubmit} method="POST" className="station-form">
        {error && (
          <Alert variant="danger" title="שגיאה בעדכון התחנה">
            {error}
          </Alert>
        )}

        <fieldset className="ys-fieldset">
          <legend>זיהוי התחנה</legend>
          <div className="ys-form-grid">
            <Input
              id="edit-station-code"
              type="text"
              label="קוד תחנה (לקריאה בלבד)"
              helperText="קוד התחנה משמש כמזהה ייחודי ואינו ניתן לשינוי."
              value={station.code}
              dir="ltr"
              disabled
            />
            <Input
              id="edit-station-name"
              name="name"
              type="text"
              label="שם תחנה"
              isRequired
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="ys-fieldset">
          <legend>פרטי קשר</legend>
          <div className="ys-form-grid">
            <Input
              id="edit-station-address"
              name="address"
              type="text"
              label="כתובת"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Input
              id="edit-station-phone"
              name="phone"
              type="tel"
              label="טלפון"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="ys-fieldset">
          <legend>סטטוס ואזור זמן</legend>
          <div className="ys-form-grid">
            <div className="ys-form-field">
              <label className="ys-label" htmlFor="edit-station-tz">
                אזור זמן
              </label>
              <select
                id="edit-station-tz"
                name="timezone"
                dir="ltr"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="Asia/Jerusalem">Asia/Jerusalem (ישראל UTC+2/3)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div className="station-switch-row">
              <input
                id="edit-station-active"
                name="isActive"
                type="checkbox"
                role="switch"
                className="ys-switch"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="edit-station-active">
                <strong>תחנה פעילה</strong>
                <span>מאפשרת גישת עובדים ומנהלים</span>
              </label>
            </div>
          </div>
        </fieldset>

        <div className="ys-form-actions">
          <Button
            variant="primary"
            type="submit"
            isLoading={isPending}
            rightIcon={<CheckIcon size={18} aria-hidden="true" />}
          >
            {isPending ? 'שומר שינויים...' : 'שמור שינויים'}
          </Button>
          <Link
            href={`/stations/${encodeURIComponent(station.code)}`}
            className="ys-button ys-button--ghost"
          >
            <span>ביטול וחזרה</span>
          </Link>
        </div>
      </form>
    </Card>
  );
};
