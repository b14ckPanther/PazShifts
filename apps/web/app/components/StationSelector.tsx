'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { StationWithMembership } from '@yellowshifts/types';
import { t } from '@yellowshifts/i18n';

interface StationSelectorProps {
  memberships: readonly StationWithMembership[];
  activeStationId: string;
}

export const StationSelector: React.FC<StationSelectorProps> = ({
  memberships,
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
    <div className="worker-station-selector">
      <label
        htmlFor="station-select"
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--ys-color-text-secondary)',
        }}
      >
        {t('stationSelect.change')}:
      </label>
      <select
        id="station-select"
        value={activeStationId}
        onChange={handleStationChange}
        style={{
          padding: '6px 12px',
          borderRadius: 'var(--ys-radius-md)',
          border: '1px solid var(--ys-color-border-subtle)',
          backgroundColor: 'var(--ys-color-surface-raised)',
          color: 'var(--ys-color-text-primary)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          direction: 'rtl',
        }}
      >
        {memberships.map((item) => (
          <option key={item.station.id} value={item.station.id}>
            {item.station.name} ({item.station.code}) —{' '}
            {t(
              `roles.${item.membership.role === 'ADMIN' ? 'stationAdmin' : item.membership.role === 'SHIFT_MANAGER' ? 'shiftManager' : 'worker'}`
            )}
          </option>
        ))}
      </select>
    </div>
  );
};
