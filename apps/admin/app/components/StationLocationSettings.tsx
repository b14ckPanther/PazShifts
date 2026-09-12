'use client';
import { useState, useTransition } from 'react';
import type { Station } from '@yellowshifts/types';
import { Button } from '@yellowshifts/ui';
import { saveStationLocation } from '../actions/station-location';
import './station-location.css';
import { StationLocationFields } from './StationLocationFields';
export function StationLocationSettings({ station }: { station: Station }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  return (
    <form
      className="station-location-settings"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setMessage('');
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
                ? 'מיקום התחנה נשמר.'
                : 'לא ניתן לשמור. בדקו הרשאות, פרטים והפעלת עדכון המערכת.'
            );
          } catch {
            setMessage('השמירה לא אושרה. נסו שוב.');
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
          <Button type="submit" isLoading={pending}>
            שמירת מיקום וטווח
          </Button>
          <p role="status" hidden={!message}>
            {message}
          </p>
        </div>
      </StationLocationFields>
    </form>
  );
}
