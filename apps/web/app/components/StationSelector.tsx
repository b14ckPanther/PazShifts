'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { StationWithMembership } from '@yellowshifts/types';
import { t } from '@yellowshifts/i18n';
import {
  StationIcon,
  ChevronDownIcon,
  CheckIcon,
  RefreshIcon,
} from '@yellowshifts/icons';
import './station-selector.css';

interface StationSelectorProps {
  memberships: readonly StationWithMembership[];
  activeStationId: string;
}

export const StationSelector: React.FC<StationSelectorProps> = ({
  memberships,
  activeStationId,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeMembership =
    memberships.find(
      (item) =>
        item.station.id === activeStationId ||
        item.station.code.toUpperCase() === activeStationId.toUpperCase()
    ) || memberships[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!activeMembership || memberships.length <= 1) {
    return null;
  }

  const handleSelectStation = (item: StationWithMembership) => {
    const isCurrent =
      item.station.id === activeStationId ||
      item.station.code.toUpperCase() === activeStationId.toUpperCase();

    setIsOpen(false);
    if (isCurrent) return;

    setIsNavigating(true);

    const canonicalCode = encodeURIComponent(item.station.code);

    // Preserve the sub-view if on availability or hours
    if (pathname.includes('/availability')) {
      router.push(`/stations/${canonicalCode}/availability`);
    } else if (pathname.includes('/hours')) {
      router.push(`/stations/${canonicalCode}/hours`);
    } else {
      router.push(`/stations/${canonicalCode}`);
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'ADMIN') return t('roles.stationAdmin');
    if (role === 'SHIFT_MANAGER') return t('roles.shiftManager');
    return t('roles.worker');
  };

  return (
    <div className="worker-station-selector-wrapper" ref={containerRef}>
      <div className="worker-station-selector-label">
        <span className="worker-station-selector-label-icon" aria-hidden="true">
          <RefreshIcon size={13} strokeWidth={2.5} />
        </span>
        <span>{t('stationSelect.change')}:</span>
      </div>

      <div className="worker-station-selector-dropdown-box">
        <button
          type="button"
          className={`worker-station-selector-trigger ${isOpen ? 'is-open' : ''}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`${t('stationSelect.change')}: ${activeMembership.station.name}`}
          disabled={isNavigating}
        >
          <div className="worker-station-selector-trigger-content">
            <div className="worker-station-selector-chip-icon" aria-hidden="true">
              <StationIcon size={14} />
            </div>
            <span className="worker-station-selector-current-name">
              {activeMembership.station.name}
            </span>
            <span className="worker-station-selector-code-chip">
              {activeMembership.station.code}
            </span>
          </div>

          <div
            className={`worker-station-selector-chevron ${isOpen ? 'is-open' : ''}`}
            aria-hidden="true"
          >
            <ChevronDownIcon size={16} strokeWidth={2.2} />
          </div>
        </button>

        {isOpen && (
          <div
            className="worker-station-selector-menu"
            role="listbox"
            aria-label="רשימת תחנות לבחירה"
          >
            <div className="worker-station-selector-menu-header">
              <span className="worker-station-selector-menu-title">
                {t('stationSelect.title')}
              </span>
              <span className="worker-station-selector-menu-badge">
                {memberships.length} תחנות
              </span>
            </div>

            <div className="worker-station-selector-menu-list">
              {memberships.map((item) => {
                const isSelected =
                  item.station.id === activeStationId ||
                  item.station.code.toUpperCase() === activeStationId.toUpperCase();

                const roleName = getRoleLabel(item.membership.role);

                return (
                  <button
                    key={item.station.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`worker-station-selector-menu-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectStation(item)}
                  >
                    <div className="worker-station-selector-menu-item-info">
                      <div className="worker-station-selector-menu-item-icon" aria-hidden="true">
                        <StationIcon size={16} />
                      </div>
                      <div>
                        <div className="worker-station-selector-menu-item-name">
                          {item.station.name}
                        </div>
                        <div className="worker-station-selector-menu-item-meta">
                          <span className="worker-station-selector-code-chip">
                            {item.station.code}
                          </span>
                          <span>•</span>
                          <span>{roleName}</span>
                        </div>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="worker-station-selector-check-badge" title="תחנה נבחרת">
                        <CheckIcon size={13} strokeWidth={3} />
                      </div>
                    ) : (
                      <div className="worker-station-selector-action-hint">מעבר לתחנה</div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="worker-station-selector-menu-footer">
              שיוך התחנות מנוהל על ידי מנהלי התחנות
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
