'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { BrandMark } from '@yellowshifts/ui';
import {
  HomeIcon,
  BriefcaseIcon,
  CalendarIcon,
  ClockIcon,
  ChevronDownIcon,
} from '@yellowshifts/icons';
import { NavigationLink as Link } from './NavigationLink';
import { LogoutButton } from './LogoutButton';
import './worker-header.css';

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
  activeTab?: 'home' | 'shifts' | 'availability' | 'hours';
  pageTitle?: string;
  subtitle?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Sticky yellow canopy: station identity, desktop tabs and the account menu. */
export const WorkerHeader: React.FC<WorkerHeaderProps> = ({
  station,
  user,
  profile,
  role,
  isPlatformAdmin,
  activeTab = 'shifts',
  pageTitle,
  subtitle,
}) => {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', escape);
    };
  }, [accountOpen]);

  const personName = profile?.fullName?.trim() || user.email?.split('@')[0] || 'עובד';
  const roleText = isPlatformAdmin
    ? 'מנהל מערכת ראשי'
    : role === 'ADMIN'
      ? 'מנהל תחנה'
      : role === 'SHIFT_MANAGER'
        ? 'מנהל משמרת'
        : 'עובד תחנה';

  const canonicalCode = encodeURIComponent(station.code);
  const context = subtitle || pageTitle || `קוד תחנה ${station.code}`;
  const tabs = [
    { key: 'home', href: `/stations/${canonicalCode}/home`, label: 'ראשי', Icon: HomeIcon },
    {
      key: 'shifts',
      href: `/stations/${canonicalCode}`,
      label: 'המשמרות שלי',
      Icon: BriefcaseIcon,
    },
    {
      key: 'availability',
      href: `/stations/${canonicalCode}/availability`,
      label: 'הזמינות שלי',
      Icon: CalendarIcon,
    },
    { key: 'hours', href: `/stations/${canonicalCode}/hours`, label: 'השעות שלי', Icon: ClockIcon },
  ] as const;

  return (
    <header className="worker-header-root">
      <div className="worker-header-inner">
        <Link
          href={`/stations/${canonicalCode}`}
          className="worker-header-brand"
          aria-label={`${station.name}, המשמרות שלי`}
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
          {tabs.map(({ key, href, label, Icon }) => (
            <Link
              key={key}
              href={href}
              className="worker-header-tab"
              aria-current={activeTab === key ? 'page' : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="worker-header-account" ref={accountRef}>
          <button
            type="button"
            className="worker-header-account-trigger"
            aria-expanded={accountOpen}
            aria-controls={panelId}
            aria-label={`החשבון שלי: ${personName}, ${roleText}`}
            onClick={() => setAccountOpen((open) => !open)}
          >
            <span className="worker-header-avatar" aria-hidden="true">
              {initials(personName)}
            </span>
            <span className="worker-header-account-name" aria-hidden="true">
              {personName}
            </span>
            <ChevronDownIcon
              size={16}
              aria-hidden="true"
              className="worker-header-account-chevron"
            />
          </button>
          <div id={panelId} className="worker-header-account-panel" hidden={!accountOpen}>
            <div className="worker-header-account-person">
              <span className="worker-header-avatar worker-header-avatar--lg" aria-hidden="true">
                {initials(personName)}
              </span>
              <div>
                <strong>{personName}</strong>
                <span>{roleText}</span>
              </div>
            </div>
            <dl className="worker-header-account-meta">
              <div>
                <dt>תחנה</dt>
                <dd>{station.name}</dd>
              </div>
              <div>
                <dt>קוד תחנה</dt>
                <dd className="ys-num" dir="ltr">
                  {station.code}
                </dd>
              </div>
            </dl>
            <LogoutButton variant="secondary" />
          </div>
        </div>
      </div>
    </header>
  );
};
