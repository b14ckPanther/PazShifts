'use client';
import { useState, useTransition } from 'react';
import type { Station } from '@yellowshifts/types';
import { Button } from '@yellowshifts/ui';
import { MapPinIcon } from '@yellowshifts/icons';
import { saveStationLocation } from '../actions/station-location';
import './station-location.css';
import { StationLocationFields } from './StationLocationFields';
export function StationLocationSettings({ station }: { station: Station }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  return (
    <form
      className="station-location-settings"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setMessage(null);
        startTransition(async () => {
          try {
            const result = await saveStationLocation(
              station.id,
              Number(data.get('latitude')),
              Number(data.get('longitude')),
              Number(data.get('attendanceRadiusM'))
            );
            setMessage(
              result.success
                ? { tone: 'success', text: 'מיקום התחנה נשמר.' }
                : {
                    tone: 'error',
                    text: 'לא ניתן לשמור. בדקו הרשאות, פרטים והפעלת עדכון המערכת.',
                  }
            );
          } catch {
            setMessage({ tone: 'error', text: 'השמירה לא אושרה. נסו שוב.' });
          }
        });
      }}
    >
      <StationLocationFields
        latitude={station.latitude}
        longitude={station.longitude}
        radius={station.attendanceRadiusM}
      >
        <div className="station-location-actions">
          <Button
            type="submit"
            isLoading={pending}
            rightIcon={<MapPinIcon size={18} aria-hidden="true" />}
          >
            שמירת מיקום וטווח
          </Button>
          <div role="status" aria-live="polite">
            {message && (
              <p className={`admin-feedback admin-feedback--${message.tone}`}>
                <span>{message.text}</span>
              </p>
            )}
          </div>
        </div>
      </StationLocationFields>
    </form>
  );
}
