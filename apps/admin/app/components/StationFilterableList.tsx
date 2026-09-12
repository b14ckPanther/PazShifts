'use client';

import React, { useState, useMemo } from 'react';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Input,
} from '@yellowshifts/ui';
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

export const StationFilterableList: React.FC<StationFilterableListProps> = ({
  stations,
  memberCounts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

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
      <Card>
        <CardContent>
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--ys-color-brand-yellow-subtle, #FEF3C7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ys-color-text-primary, #111827)',
              }}
            >
              <StationIcon size={28} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--ys-color-text-primary, #111827)',
                  margin: 0,
                }}
              >
                טרם הוקמו תחנות במערכת
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--ys-color-text-secondary, #6B7280)',
                  margin: '6px 0 0 0',
                }}
              >
                הקם את התחנה הראשונה כדי להתחיל לנהל צוותים ומשמרות.
              </p>
            </div>
            <Link href="/stations/new" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <PlusIcon size={16} />
                  הקמת תחנה חדשה
                </span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search and Filters Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          backgroundColor: 'var(--ys-color-surface-raised, #FFFFFF)',
          padding: '16px',
          borderRadius: 'var(--ys-radius-md)',
          border: '1px solid var(--ys-color-border-subtle, #E5E7EB)',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
          <Input
            id="station-search"
            type="text"
            placeholder="חיפוש לפי שם, קוד או כתובת תחנה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant={statusFilter === 'ALL' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('ALL')}
          >
            הכל ({stations.length})
          </Button>
          <Button
            variant={statusFilter === 'ACTIVE' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('ACTIVE')}
          >
            פעילות ({stations.filter((s) => s.isActive).length})
          </Button>
          <Button
            variant={statusFilter === 'INACTIVE' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('INACTIVE')}
          >
            מושבתות ({stations.filter((s) => !s.isActive).length})
          </Button>
        </div>
      </div>

      {/* Stations Grid */}
      {filteredStations.length === 0 ? (
        <Card>
          <CardContent>
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--ys-color-text-secondary, #6B7280)',
              }}
            >
              <SearchIcon size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div>לא נמצאו תחנות התואמות את החיפוש או הסינון.</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredStations.map((station) => {
            const counts = memberCounts[station.id] ?? { total: 0, admins: 0 };

            return (
              <Card key={station.id}>
                <CardHeader>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px',
                        }}
                      >
                        <Badge variant="brandYellow">{station.code}</Badge>
                        <Badge variant={station.isActive ? 'success' : 'neutral'} dot>
                          {station.isActive ? 'פעילה' : 'מושבתת'}
                        </Badge>
                      </div>
                      <CardTitle style={{ fontSize: '17px' }}>{station.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      fontSize: '13px',
                      color: 'var(--ys-color-text-secondary, #4B5563)',
                    }}
                  >
                    {station.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPinIcon size={14} color="var(--ys-color-text-muted, #9CA3AF)" />
                        <span>{station.address}</span>
                      </div>
                    )}
                    {station.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PhoneIcon size={14} color="var(--ys-color-text-muted, #9CA3AF)" />
                        <span dir="ltr">{station.phone}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ClockIcon size={14} color="var(--ys-color-text-muted, #9CA3AF)" />
                      <span>{station.timezone}</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--ys-color-border-subtle, #E5E7EB)',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color:
                            counts.admins > 0 ? '#B45309' : 'var(--ys-color-text-muted, #9CA3AF)',
                        }}
                      >
                        <ShieldCheckIcon size={15} />
                        <strong>{counts.admins}</strong> מנהלי תחנה
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--ys-color-text-secondary, #4B5563)',
                        }}
                      >
                        <UsersIcon size={15} />
                        <strong>{counts.total}</strong> אנשי צוות
                      </span>
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
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Link
                        href={`/stations/${encodeURIComponent(station.code)}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <Button variant="secondary" size="sm">
                          ניהול וצוות
                        </Button>
                      </Link>

                      <Link
                        href={`/stations/${encodeURIComponent(station.code)}/edit`}
                        style={{ textDecoration: 'none' }}
                      >
                        <Button variant="ghost" size="sm" title="עריכת תחנה">
                          <EditIcon size={14} />
                        </Button>
                      </Link>
                    </div>

                    <StationStatusToggle
                      stationId={station.id}
                      isActive={station.isActive}
                      stationName={station.name}
                    />
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
