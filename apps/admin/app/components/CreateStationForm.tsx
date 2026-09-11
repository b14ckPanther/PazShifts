'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Alert,
} from '@yellowshifts/ui';
import { StationIcon, PlusIcon, ArrowRightIcon } from '@yellowshifts/icons';
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
    <Card
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <form
        method="POST"
        action="#"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleManualSubmit();
        }}
      >
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <StationIcon size={22} color="var(--ys-color-brand-yellow)" />
            <CardTitle style={{ color: '#111827' }}>הקמת תחנה חדשה</CardTitle>
          </div>
          <CardDescription style={{ color: '#4B5563' }}>
            הזן את פרטי התחנה כדי להקימה במערכת.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <Alert variant="danger" title="שגיאה ביצירת התחנה">
                {error}
              </Alert>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="station-code"
                  style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}
                >
                  קוד תחנה <span style={{ color: 'var(--ys-color-brand-crimson)' }}>*</span>
                </label>
                <Input
                  id="station-code"
                  name="code"
                  type="text"
                  placeholder="לדוגמה: PAZ-TLV-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  style={{ textTransform: 'uppercase' }}
                />
                <span style={{ fontSize: '11px', color: '#6B7280' }}>
                  אותיות באנגלית ומספרים בלבד. משמש כמזהה ייחודי.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="station-name"
                  style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}
                >
                  שם תחנה <span style={{ color: 'var(--ys-color-brand-crimson)' }}>*</span>
                </label>
                <Input
                  id="station-name"
                  name="name"
                  type="text"
                  placeholder="לדוגמה: תחנת פז כורדני"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="station-address"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}
                >
                  כתובת
                </label>
                <Input
                  id="station-address"
                  name="address"
                  type="text"
                  placeholder="רחוב, מספר ועיר"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="station-phone"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}
                >
                  טלפון
                </label>
                <Input
                  id="station-phone"
                  name="phone"
                  type="tel"
                  placeholder="03-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="station-tz"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}
                >
                  אזור זמן
                </label>
                <select
                  id="station-tz"
                  name="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    borderRadius: 'var(--ys-radius-sm)',
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    color: '#111827',
                    fontSize: '14px',
                    outline: 'none',
                    direction: 'ltr',
                  }}
                >
                  <option value="Asia/Jerusalem">Asia/Jerusalem (ישראל UTC+2/3)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  paddingTop: '24px',
                }}
              >
                <input
                  id="station-active"
                  name="isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="station-active"
                  style={{ fontSize: '14px', fontWeight: 500, color: '#111827', cursor: 'pointer' }}
                >
                  תחנה פעילה (מאפשרת כניסת עובדים ומנהלים)
                </label>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: '12px',
            }}
          >
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="md" type="button">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowRightIcon size={16} />
                  ביטול וחזרה
                </span>
              </Button>
            </Link>

            <Button
              variant="primary"
              size="md"
              type="button"
              onClick={handleManualSubmit}
              disabled={isPending}
              isLoading={isPending}
              style={{ minWidth: '160px' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <PlusIcon size={16} />
                {isPending ? 'יוצר תחנה...' : 'צור תחנה'}
              </span>
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
};
