'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { BrandMark } from '@yellowshifts/ui';
import type { StationWithMembership } from '@yellowshifts/types';
import {
  AvailabilityGlyph,
  CanopyGlyph,
  CheckGlyph,
  CloseGlyph,
  MenuGlyph,
  RosterGlyph,
  StopwatchGlyph,
} from '@yellowshifts/icons';
import { NavigationLink as Link } from './NavigationLink';
import { LogoutButton } from './LogoutButton';
import { NotificationSetting } from './PushNotifications';
import './worker-header.css';

type Tab = 'home' | 'shifts' | 'availability' | 'hours';

interface WorkerHeaderProps {
  station: {
    id: string;
    name: string;
    code: string;
    timezone?: string;
  };
  user: {
    id: string;
    email?: string | null;
  };
  profile?: {
    fullName?: string | null;
  } | null;
  role?: string | null;
  isPlatformAdmin?: boolean;
  /** Every station the worker belongs to; more than one turns on the switcher in the menu. */
  memberships?: readonly StationWithMembership[];
  activeTab?: Tab;
  pageTitle?: string;
  subtitle?: string;
}

const SUFFIX: Record<Tab, string> = {
  home: '/home',
  shifts: '',
  availability: '/availability',
  hours: '/hours',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function roleName(role?: string | null, isPlatformAdmin?: boolean) {
  if (isPlatformAdmin) return 'מנהל מערכת ראשי';
  if (role === 'ADMIN') return 'מנהל תחנה';
  if (role === 'SHIFT_MANAGER') return 'מנהל משמרת';
  return 'עובד תחנה';
}

/** Sticky yellow canopy: station identity, the section tabs and the menu drawer. */
export const WorkerHeader: React.FC<WorkerHeaderProps> = ({
  station,
  user,
  profile,
  role,
  isPlatformAdmin,
  memberships = [],
  activeTab = 'shifts',
  pageTitle,
  subtitle,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tapped, setTapped] = useState<Tab | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerId = useId();

  useEffect(() => setTapped(null), [activeTab, station.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    document.documentElement.classList.add('worker-menu-open');
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.documentElement.classList.remove('worker-menu-open');
      document.removeEventListener('keydown', escape);
      trigger?.focus();
    };
  }, [menuOpen]);

  const personName = profile?.fullName?.trim() || user.email?.split('@')[0] || 'עובד';
  const roleText = roleName(role, isPlatformAdmin);
  const canonicalCode = encodeURIComponent(station.code);
  const context = subtitle || pageTitle || `קוד תחנה ${station.code}`;
  const tabs = [
    { key: 'home', label: 'ראשי', short: 'ראשי', Icon: CanopyGlyph },
    { key: 'shifts', label: 'המשמרות שלי', short: 'משמרות', Icon: RosterGlyph },
    { key: 'availability', label: 'הזמינות שלי', short: 'זמינות', Icon: AvailabilityGlyph },
    { key: 'hours', label: 'השעות שלי', short: 'שעות', Icon: StopwatchGlyph },
  ] as const;
  const selected = tapped ?? activeTab;
  const stations = memberships.length > 1 ? memberships : [];

  return (
    <header className="worker-header-root">
      <div className="worker-header-inner">
        <Link
          href={`/stations/${canonicalCode}/home`}
          className="worker-header-brand"
          aria-label={`${station.name}, ראשי`}
        >
          <span className="worker-header-logo" aria-hidden="true">
            <BrandMark size={26} />
          </span>
          <span className="worker-header-titles">
            <span className="worker-header-title">{station.name}</span>
            <span className="worker-header-subtitle">{context}</span>
          </span>
        </Link>

        <nav className="worker-header-tabs" aria-label="ניווט ראשי">
          {tabs.map(({ key, label, short, Icon }) => (
            <Link
              key={key}
              href={`/stations/${canonicalCode}${SUFFIX[key]}`}
              className="worker-header-tab"
              aria-current={activeTab === key ? 'page' : undefined}
              data-selected={selected === key || undefined}
              onClick={() => {
                if (key !== activeTab) setTapped(key);
              }}
            >
              <Icon size={19} variant={selected === key ? 'solid' : 'line'} />
              <span className="worker-header-tab-label">{label}</span>
              <span className="worker-header-tab-short" aria-hidden="true">
                {short}
              </span>
            </Link>
          ))}
        </nav>

        <button
          ref={triggerRef}
          type="button"
          className="worker-header-menu-trigger"
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          aria-label={`תפריט: ${personName}, חשבון והחלפת תחנה`}
          onClick={() => setMenuOpen(true)}
        >
          <span className="worker-header-avatar" aria-hidden="true">
            {initials(personName)}
          </span>
          <span className="worker-header-menu-name" aria-hidden="true">
            {personName}
          </span>
          <MenuGlyph size={22} strokeWidth={2} />
        </button>
      </div>

      <div className="worker-menu" data-open={menuOpen || undefined}>
        <button
          type="button"
          className="worker-menu-scrim"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
        />
        <aside
          id={drawerId}
          className="worker-menu-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="תפריט"
          hidden={!menuOpen}
        >
          <div className="worker-menu-head">
            <span className="worker-header-avatar worker-header-avatar--lg" aria-hidden="true">
              {initials(personName)}
            </span>
            <div>
              <strong>{personName}</strong>
              <span>{roleText}</span>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="worker-menu-close"
              aria-label="סגירת התפריט"
              onClick={() => setMenuOpen(false)}
            >
              <CloseGlyph size={20} strokeWidth={2} />
            </button>
          </div>

          {stations.length > 0 ? (
            <section className="worker-menu-section" aria-labelledby={`${drawerId}-stations`}>
              <h2 id={`${drawerId}-stations`}>התחנות שלי</h2>
              <ul className="worker-menu-stations">
                {stations.map((item) => {
                  const current = item.station.id === station.id;
                  return (
                    <li key={item.station.id}>
                      <Link
                        href={`/stations/${encodeURIComponent(item.station.code)}${SUFFIX[activeTab]}`}
                        aria-current={current ? 'true' : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="worker-menu-station-icon" aria-hidden="true">
                          <CanopyGlyph size={20} variant={current ? 'solid' : 'duo'} />
                        </span>
                        <span className="worker-menu-station-text">
                          <strong>{item.station.name}</strong>
                          <small>
                            <span className="ys-num" dir="ltr">
                              {item.station.code}
                            </span>
                            {' · '}
                            {roleName(item.membership.role)}
                          </small>
                        </span>
                        {current && <CheckGlyph size={20} strokeWidth={2.4} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section className="worker-menu-section" aria-labelledby={`${drawerId}-station`}>
              <h2 id={`${drawerId}-station`}>התחנה שלי</h2>
              <div className="worker-menu-stations">
                <div className="worker-menu-station-static">
                  <span className="worker-menu-station-icon" aria-hidden="true">
                    <CanopyGlyph size={20} variant="solid" />
                  </span>
                  <span className="worker-menu-station-text">
                    <strong>{station.name}</strong>
                    <small>
                      קוד תחנה{' '}
                      <span className="ys-num" dir="ltr">
                        {station.code}
                      </span>
                    </small>
                  </span>
                </div>
              </div>
            </section>
          )}

          <NotificationSetting />

          <div className="worker-menu-foot">
            <LogoutButton variant="secondary" />
          </div>
        </aside>
      </div>
    </header>
  );
};
