'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { StationWithMembership } from '@yellowshifts/types';
import { t } from '@yellowshifts/i18n';
import {
  StationIcon,
  ChevronDownIcon,
  CheckIcon,
  RefreshIcon,
} from '@yellowshifts/icons';
import './station-admin-selector.css';

interface StationAdminSelectorProps {
  adminMemberships: readonly StationWithMembership[];
  activeStationId: string;
}

export const StationAdminSelector: React.FC<StationAdminSelectorProps> = ({
  adminMemberships,
  activeStationId,
}) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeMembership =
    adminMemberships.find(
      (item) =>
        item.station.id === activeStationId ||
        item.station.code.toUpperCase() === activeStationId.toUpperCase()
    ) || adminMemberships[0];

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

  if (!activeMembership || adminMemberships.length <= 1) {
    return null;
  }

  const handleSelectStation = (item: StationWithMembership) => {
    const isCurrent =
      item.station.id === activeStationId ||
      item.station.code.toUpperCase() === activeStationId.toUpperCase();

    setIsOpen(false);
    if (isCurrent) return;

    setIsNavigating(true);
    router.push(`/stations/${encodeURIComponent(item.station.code)}`);
  };

  return (
    <div className="station-admin-selector-wrapper" ref={containerRef}>
      <div className="station-admin-selector-label">
        <span className="station-admin-selector-label-icon" aria-hidden="true">
          <RefreshIcon size={13} strokeWidth={2.5} />
        </span>
        <span>{t('stationSelect.change')}:</span>
      </div>

      <div className="station-admin-selector-dropdown-box">
        <button
          type="button"
          className={`station-admin-selector-trigger ${isOpen ? 'is-open' : ''}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`${t('stationSelect.change')}: ${activeMembership.station.name}`}
          disabled={isNavigating}
        >
          <div className="station-admin-selector-trigger-content">
            <div className="station-admin-selector-chip-icon" aria-hidden="true">
              <StationIcon size={14} />
            </div>
            <span className="station-admin-selector-current-name">
              {activeMembership.station.name}
            </span>
            <span className="station-admin-selector-code-chip">
              {activeMembership.station.code}
            </span>
          </div>

          <div
            className={`station-admin-selector-chevron ${isOpen ? 'is-open' : ''}`}
            aria-hidden="true"
          >
            <ChevronDownIcon size={16} strokeWidth={2.5} />
          </div>
        </button>

        {isOpen && (
          <div
            className="station-admin-selector-menu"
            role="listbox"
            aria-label={t('stationSelect.title')}
          >
            <div className="station-admin-selector-menu-header">
              <span className="station-admin-selector-menu-title">
                תחנות פעילות בניהולך ({adminMemberships.length})
              </span>
              <span className="station-admin-selector-menu-badge">
                מנהל תחנה
              </span>
            </div>

            <div className="station-admin-selector-menu-list">
              {adminMemberships.map((item) => {
                const isSelected =
                  item.station.id === activeStationId ||
                  item.station.code.toUpperCase() === activeStationId.toUpperCase();

                return (
                  <button
                    key={item.station.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`station-admin-selector-menu-item ${
                      isSelected ? 'is-selected' : ''
                    }`}
                    onClick={() => handleSelectStation(item)}
                  >
                    <div className="station-admin-selector-menu-item-info">
                      <div className="station-admin-selector-menu-item-icon" aria-hidden="true">
                        <StationIcon size={16} />
                      </div>
                      <div>
                        <div className="station-admin-selector-menu-item-name">
                          {item.station.name}
                        </div>
                        <div className="station-admin-selector-menu-item-meta">
                          <span>קוד: {item.station.code}</span>
                          {item.station.address && (
                            <>
                              <span>•</span>
                              <span>{item.station.address}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="station-admin-selector-check-badge" aria-label="תחנה נוכחית">
                        <CheckIcon size={12} strokeWidth={3} />
                      </div>
                    ) : (
                      <span className="station-admin-selector-action-hint">מעבר לתחנה</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="station-admin-selector-menu-footer">
              בחירת תחנה תעביר אותך ישירות ללוח הניהול שלה
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
