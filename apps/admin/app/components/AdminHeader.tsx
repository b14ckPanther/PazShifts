'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@yellowshifts/ui';
import { ChevronDownIcon } from '@yellowshifts/icons';
import type { AuthenticatedUserContext } from '@yellowshifts/types';
import { NavigationLink as Link } from './NavigationLink';
import { LogoutButton } from './LogoutButton';
import { isStationNavActive, stationNavItems } from './station-nav';
import './admin-header.css';

export interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  homeHref: string;
  homeLabel?: string;
  context: AuthenticatedUserContext;
  /** Enables the station section tabs and station facts in the account menu. */
  station?: { id: string; name: string; code: string };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Sticky yellow canopy for every admin page: identity, section tabs, account menu. */
export function AdminHeader({
  title,
  subtitle,
  homeHref,
  homeLabel,
  context,
  station,
}: AdminHeaderProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const membership = station
    ? context.memberships.find(
        (m) =>
          m.station.id === station.id || m.station.code.toUpperCase() === station.code.toUpperCase()
      )
    : undefined;
  const role =
    membership?.membership.role ??
    (context.memberships.some((m) => m.membership.role === 'ADMIN')
      ? 'ADMIN'
      : context.memberships.some((m) => m.membership.role === 'SHIFT_MANAGER')
        ? 'SHIFT_MANAGER'
        : undefined);
  const roleText = context.isPlatformAdmin
    ? 'מנהל פלטפורמה'
    : role === 'ADMIN'
      ? 'מנהל תחנה'
      : role === 'SHIFT_MANAGER'
        ? 'מנהל משמרת'
        : 'משתמש';
  const personName =
    context.profile?.fullName?.trim() || context.user.email?.split('@')[0] || roleText;

  const admin = context.isPlatformAdmin || role === 'ADMIN';
  const canSchedule = admin || role === 'SHIFT_MANAGER';
  const base = station ? `/stations/${encodeURIComponent(station.code)}` : '';
  const activePath = station ? path.replace(/^\/stations\/[^/]+/, base) : path;
  const tabs = station && canSchedule ? stationNavItems(base, admin) : [];

  return (
    <header className="admin-header">
      <div className="admin-header-inner">
        <Link href={homeHref} className="admin-header-brand" aria-label={homeLabel ?? title}>
          <span className="admin-header-logo" aria-hidden="true">
            <BrandMark size={26} />
          </span>
          <span className="admin-header-titles">
            <span className="admin-header-title">{title}</span>
            {subtitle && <span className="admin-header-subtitle">{subtitle}</span>}
          </span>
        </Link>

        {tabs.length > 0 && (
          <nav className="admin-header-tabs" aria-label="ניווט התחנה">
            {tabs.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="admin-header-tab"
                aria-current={isStationNavActive(href, base, activePath) ? 'page' : undefined}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="admin-header-account" ref={accountRef}>
          <button
            type="button"
            className="admin-header-account-trigger"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`החשבון שלי: ${personName}, ${roleText}`}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="admin-header-avatar" aria-hidden="true">
              {initials(personName)}
            </span>
            <span className="admin-header-account-name" aria-hidden="true">
              {personName}
              <small>{roleText}</small>
            </span>
            <ChevronDownIcon size={16} aria-hidden="true" className="admin-header-chevron" />
          </button>
          <div id={panelId} className="admin-header-panel" hidden={!open}>
            <div className="admin-header-person">
              <span className="admin-header-avatar admin-header-avatar--lg" aria-hidden="true">
                {initials(personName)}
              </span>
              <div>
                <strong>{personName}</strong>
                <span>{roleText}</span>
              </div>
            </div>
            {station && (
              <dl className="admin-header-meta">
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
            )}
            <LogoutButton variant="secondary" />
          </div>
        </div>
      </div>
    </header>
  );
}
