'use client';
import { StationLocationFields } from './StationLocationFields';

import React, { useState, useEffect, useTransition } from 'react';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { Button, Input, Card, Alert } from '@yellowshifts/ui';
import { PlusIcon } from '@yellowshifts/icons';
import { createStationAction } from '../actions/stations';

export const CreateStationForm: React.FC = () => {
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Asia/Jerusalem');
  const [isActive, setIsActive] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Populate from query params if user arrived via GET redirect (e.g. ?code=PAZ-KURDANI)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const sp = new URLSearchParams(window.location.search);
      const urlCode = sp.get('code');
      const urlName = sp.get('name');
      const urlAddress = sp.get('address');
      const urlPhone = sp.get('phone');
      const urlTz = sp.get('timezone');
      const urlActive = sp.get('isActive');

      if (urlCode) setCode(urlCode.toUpperCase());
      if (urlName) setName(urlName);
      if (urlAddress) setAddress(urlAddress);
      if (urlPhone) setPhone(urlPhone);
      if (urlTz) setTimezone(urlTz);
      if (urlActive !== null) setIsActive(urlActive === 'on' || urlActive === 'true');
    }
  }, []);

  const handleManualSubmit = () => {
    setError(null);

    // Read both state and DOM fallback in case autofill didn't fire onChange
    const codeDom = (document.getElementById('station-code') as HTMLInputElement)?.value;
    const nameDom = (document.getElementById('station-name') as HTMLInputElement)?.value;
    const addressDom = (document.getElementById('station-address') as HTMLInputElement)?.value;
    const phoneDom = (document.getElementById('station-phone') as HTMLInputElement)?.value;

    const finalCode = (code || codeDom || '').trim().toUpperCase();
    const finalName = (name || nameDom || '').trim();
    const finalAddress = (address || addressDom || '').trim();
    const finalPhone = (phone || phoneDom || '').trim();

    if (!finalCode || finalCode.length < 2) {
      setError('נא להזין קוד תחנה תקין באנגלית (לפחות 2 תווים).');
      return;
    }

    if (!finalName || finalName.length < 2) {
      setError('נא להזין שם תחנה תקין (לפחות 2 תווים).');
      return;
    }

    startTransition(async () => {
      try {
        const result = await createStationAction({
          latitude: Number(
            (document.getElementById('station-latitude') as HTMLInputElement)?.value || NaN
          ),
          longitude: Number(
            (document.getElementById('station-longitude') as HTMLInputElement)?.value || NaN
          ),
          attendanceRadiusM: Number(
            (document.getElementById('station-attendanceRadiusM') as HTMLInputElement)?.value || NaN
          ),
          code: finalCode,
          name: finalName,
          address: finalAddress || null,
          phone: finalPhone || null,
          timezone,
          isActive,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.success && result.stationId) {
          window.location.href = `/stations/${result.stationId}`;
        } else {
          setError('שגיאה בלתי צפויה ביצירת התחנה.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'שגיאה ביצירת התחנה.');
      }
    });
  };

  return (
    <Card className="station-form-card">
      <form
        method="POST"
        action="#"
        className="station-form"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleManualSubmit();
        }}
      >
        {error && (
          <Alert variant="danger" title="שגיאה ביצירת התחנה">
            {error}
          </Alert>
        )}

        <fieldset className="ys-fieldset">
          <legend>זיהוי התחנה</legend>
          <div className="ys-form-grid">
            <Input
              id="station-code"
              name="code"
              type="text"
              label="קוד תחנה"
              isRequired
              helperText="אותיות באנגלית ומספרים בלבד. משמש כמזהה ייחודי."
              placeholder="לדוגמה: PAZ-TLV-01"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              dir="ltr"
              autoCapitalize="characters"
              className="station-code-field"
            />
            <Input
              id="station-name"
              name="name"
              type="text"
              label="שם תחנה"
              isRequired
              placeholder="לדוגמה: תחנת פז כורדני"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </fieldset>

        <fieldset className="ys-fieldset">
          <legend>פרטי קשר</legend>
          <div className="ys-form-grid">
            <Input
              id="station-address"
              name="address"
              type="text"
              label="כתובת"
              placeholder="רחוב, מספר ועיר"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Input
              id="station-phone"
              name="phone"
              type="tel"
              label="טלפון"
              placeholder="03-1234567"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </fieldset>

        <StationLocationFields />

        <fieldset className="ys-fieldset">
          <legend>סטטוס ואזור זמן</legend>
          <div className="ys-form-grid">
            <div className="ys-form-field">
              <label className="ys-label" htmlFor="station-tz">
                אזור זמן
              </label>
              <select
                id="station-tz"
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
                id="station-active"
                name="isActive"
                type="checkbox"
                role="switch"
                className="ys-switch"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="station-active">
                <strong>תחנה פעילה</strong>
                <span>מאפשרת כניסת עובדים ומנהלים</span>
              </label>
            </div>
          </div>
        </fieldset>

        <div className="ys-form-actions">
          <Button
            variant="primary"
            type="button"
            onClick={handleManualSubmit}
            disabled={isPending}
            isLoading={isPending}
            rightIcon={<PlusIcon size={18} aria-hidden="true" />}
          >
            צור תחנה
          </Button>
          <Link href="/" className="ys-button ys-button--ghost">
            <span>ביטול וחזרה</span>
          </Link>
        </div>
      </form>
    </Card>
  );
};
