'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { StationWithMembership } from '@yellowshifts/types';
import { t } from '@yellowshifts/i18n';

interface StationAdminSelectorProps {
  adminMemberships: readonly StationWithMembership[];
  activeStationId: string;
}

export const StationAdminSelector: React.FC<StationAdminSelectorProps> = ({
  adminMemberships,
  activeStationId,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleStationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStationId = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set('stationId', nextStationId);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        direction: 'rtl',
      }}
    >
      <label
        htmlFor="admin-station-select"
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: '#CCCCCC',
        }}
      >
        {t('stationSelect.change')}:
      </label>
      <select
        id="admin-station-select"
        value={activeStationId}
        onChange={handleStationChange}
        style={{
          padding: '6px 12px',
          borderRadius: 'var(--ys-radius-md)',
          border: '1px solid #444444',
          backgroundColor: '#2A2A32',
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: 600,
          outline: 'none',
          cursor: 'pointer',
          direction: 'rtl',
        }}
      >
        {adminMemberships.map((item) => (
          <option key={item.station.id} value={item.station.id}>
            {item.station.name} ({item.station.code})
          </option>
        ))}
      </select>
    </div>
  );
};
