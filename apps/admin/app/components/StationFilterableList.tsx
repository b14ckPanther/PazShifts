'use client';

import React, { useState, useMemo } from 'react';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { Badge, EmptyState, Input, StatusBadge } from '@yellowshifts/ui';
import {
  StationIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  ShieldCheckIcon,
  UsersIcon,
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
} from '@yellowshifts/icons';
import type { Station } from '@yellowshifts/types';
import { StationStatusToggle } from './StationStatusToggle';

interface StationFilterableListProps {
  stations: Station[];
  memberCounts: Record<string, { total: number; admins: number }>;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export const StationFilterableList: React.FC<StationFilterableListProps> = ({
  stations,
  memberCounts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      // Filter by status
      if (statusFilter === 'ACTIVE' && !station.isActive) return false;
      if (statusFilter === 'INACTIVE' && station.isActive) return false;

      // Filter by search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const matchName = station.name.toLowerCase().includes(q);
      const matchCode = station.code.toLowerCase().includes(q);
      const matchAddress = station.address?.toLowerCase().includes(q) ?? false;

      return matchName || matchCode || matchAddress;
    });
  }, [stations, searchQuery, statusFilter]);

  if (stations.length === 0) {
    return (
      <EmptyState
        className="admin-empty-panel"
        icon={<StationIcon size={26} />}
        title="טרם הוקמו תחנות במערכת"
        description="הקם את התחנה הראשונה כדי להתחיל לנהל צוותים ומשמרות."
        action={
          <Link href="/stations/new" className="ys-button ys-button--primary">
            <PlusIcon size={18} aria-hidden="true" />
            <span>הקמת תחנה חדשה</span>
          </Link>
        }
      />
    );
  }

  const activeCount = stations.filter((s) => s.isActive).length;
  const filters: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'ALL', label: 'הכל', count: stations.length },
    { value: 'ACTIVE', label: 'פעילות', count: activeCount },
    { value: 'INACTIVE', label: 'מושבתות', count: stations.length - activeCount },
  ];

  return (
    <section className="admin-section" aria-labelledby="station-list-title">
      <div className="admin-section-header">
        <h2 id="station-list-title" className="admin-section-title">
          התחנות ברשת
        </h2>
        <span className="admin-section-description" role="status">
          מוצגות <span className="ys-num">{filteredStations.length}</span> מתוך{' '}
          <span className="ys-num">{stations.length}</span>
        </span>
      </div>

      {/* Search and Filters Bar */}
      <div className="admin-toolbar station-list-toolbar">
        <Input
          id="station-search"
          type="search"
          label="חיפוש תחנה"
          placeholder="שם, קוד או כתובת"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          rightIcon={<SearchIcon size={18} aria-hidden="true" />}
          className="station-list-search"
        />

        <div className="ys-segmented station-list-filter" role="group" aria-label="סינון לפי סטטוס">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label} <span className="ys-num">({filter.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stations Grid */}
      {filteredStations.length === 0 ? (
        <EmptyState
          className="admin-empty-panel"
          icon={<SearchIcon size={24} />}
          title="לא נמצאו תחנות התואמות את החיפוש או הסינון."
        />
      ) : (
        <ul className="station-card-grid">
          {filteredStations.map((station) => {
            const counts = memberCounts[station.id] ?? { total: 0, admins: 0 };
            const stationHref = `/stations/${encodeURIComponent(station.code)}`;

            return (
              <li key={station.id} className="station-card">
                <div className="station-card-head">
                  <div className="station-card-identity">
                    <h3 className="station-card-name">{station.name}</h3>
                    <Badge variant="brandYellow" dir="ltr">
                      {station.code}
                    </Badge>
                  </div>
                  <StatusBadge
                    status={station.isActive ? 'success' : 'offline'}
                    label={station.isActive ? 'פעילה' : 'מושבתת'}
                  />
                </div>

                <ul className="station-card-facts">
                  {station.address && (
                    <li>
                      <MapPinIcon size={16} aria-hidden="true" />
                      <span>{station.address}</span>
                    </li>
                  )}
                  {station.phone && (
                    <li>
                      <PhoneIcon size={16} aria-hidden="true" />
                      <span dir="ltr">{station.phone}</span>
                    </li>
                  )}
                  <li>
                    <ClockIcon size={16} aria-hidden="true" />
                    <span dir="ltr">{station.timezone}</span>
                  </li>
                </ul>

                <div className="station-card-counts">
                  <span>
                    <ShieldCheckIcon size={16} aria-hidden="true" />
                    <strong className="ys-num">{counts.admins}</strong> מנהלי תחנה
                  </span>
                  <span>
                    <UsersIcon size={16} aria-hidden="true" />
                    <strong className="ys-num">{counts.total}</strong> אנשי צוות
                  </span>
                </div>

                <div className="station-card-actions">
                  <Link href={stationHref} className="ys-button ys-button--secondary ys-button--sm">
                    <span>ניהול וצוות</span>
                  </Link>
                  <Link
                    href={`${stationHref}/edit`}
                    className="ys-button ys-button--ghost ys-button--sm ys-button--icon"
                    aria-label={`עריכת תחנה ${station.name}`}
                    title="עריכת תחנה"
                  >
                    <EditIcon size={16} aria-hidden="true" />
                  </Link>
                  <StationStatusToggle
                    stationId={station.id}
                    isActive={station.isActive}
                    stationName={station.name}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
