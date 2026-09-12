'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
  Badge,
  Spinner,
} from '@yellowshifts/ui';
import { EditIcon, CheckIcon, ArrowRightIcon } from '@yellowshifts/icons';
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
    <Card
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <form onSubmit={handleSubmit} method="POST">
        <CardHeader>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <EditIcon size={20} color="var(--ys-color-brand-yellow)" />
              <CardTitle>עריכת פרטי תחנת {station.name}</CardTitle>
            </div>
            <Badge variant="brandYellow">{station.code}</Badge>
          </div>
          <CardDescription>
            עדכון פרטי התחנה, כתובת, טלפון, אזור זמן או סטטוס פעילות.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <Alert variant="danger" title="שגיאה בעדכון התחנה">
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
                  htmlFor="edit-station-code"
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--ys-color-text-secondary, #6B7280)',
                  }}
                >
                  קוד תחנה (לקריאה בלבד)
                </label>
                <Input
                  id="edit-station-code"
                  type="text"
                  value={station.code}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="edit-station-name"
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--ys-color-text-primary, #111827)',
                  }}
                >
                  שם תחנה <span style={{ color: 'var(--ys-color-brand-crimson)' }}>*</span>
                </label>
                <Input
                  id="edit-station-name"
                  name="name"
                  type="text"
                  value={name}
                  required
                  onChange={(e) => setName(e.target.value)}
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
                  htmlFor="edit-station-address"
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--ys-color-text-primary, #111827)',
                  }}
                >
                  כתובת
                </label>
                <Input
                  id="edit-station-address"
                  name="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="edit-station-phone"
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--ys-color-text-primary, #111827)',
                  }}
                >
                  טלפון
                </label>
                <Input
                  id="edit-station-phone"
                  name="phone"
                  type="tel"
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
                  htmlFor="edit-station-tz"
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--ys-color-text-primary, #111827)',
                  }}
                >
                  אזור זמן
                </label>
                <select
                  id="edit-station-tz"
                  name="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    borderRadius: 'var(--ys-radius-sm)',
                    border: '1px solid var(--ys-color-border-subtle, #E5E7EB)',
                    backgroundColor: 'var(--ys-color-surface-raised, #FFFFFF)',
                    color: 'var(--ys-color-text-primary, #111827)',
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
                  id="edit-station-active"
                  name="isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="edit-station-active"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--ys-color-text-primary, #111827)',
                    cursor: 'pointer',
                  }}
                >
                  תחנה פעילה (מאפשרת גישת עובדים ומנהלים)
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
            <Link
              href={`/stations/${encodeURIComponent(station.code)}`}
              style={{ textDecoration: 'none' }}
            >
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
              type="submit"
              disabled={isPending}
              style={{ minWidth: '160px' }}
            >
              {isPending ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Spinner size="sm" color="var(--ys-color-text-inverse, #FFFFFF)" />
                  שומר שינויים...
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <CheckIcon size={16} />
                  שמור שינויים
                </span>
              )}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
};
