'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@yellowshifts/ui';
import { CanopyGlyph, CheckGlyph, CloseGlyph, MenuGlyph } from '@yellowshifts/icons';
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
  /** Enables the station section tabs and the station switcher in the menu. */
  station?: { id: string; name: string; code: string };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function roleName(role?: string, platform?: boolean) {
  if (platform) return 'מנהל פלטפורמה';
  if (role === 'ADMIN') return 'מנהל תחנה';
  if (role === 'SHIFT_MANAGER') return 'מנהל משמרת';
  return 'משתמש';
}

/** Sticky yellow canopy for every admin page: identity, section tabs and the menu drawer.
    Navigation stays at the top so nothing is pinned to Safari's collapsing bottom edge. */
export function AdminHeader({
  title,
  subtitle,
  homeHref,
  homeLabel,
  context,
  station,
}: AdminHeaderProps) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tapped, setTapped] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerId = useId();

  useEffect(() => setTapped(null), [path]);
  useEffect(() => {
    if (!menuOpen) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    document.documentElement.classList.add('admin-menu-open');
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.documentElement.classList.remove('admin-menu-open');
      document.removeEventListener('keydown', escape);
      trigger?.focus();
    };
  }, [menuOpen]);

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
  const roleText = roleName(role, context.isPlatformAdmin);
  const personName =
    context.profile?.fullName?.trim() || context.user.email?.split('@')[0] || roleText;

  const admin = context.isPlatformAdmin || role === 'ADMIN';
  const canSchedule = admin || role === 'SHIFT_MANAGER';
  const base = station ? `/stations/${encodeURIComponent(station.code)}` : '';
  const activePath = station ? path.replace(/^\/stations\/[^/]+/, base) : path;
  const tabs = station && canSchedule ? stationNavItems(base, admin) : [];
  const current = tabs.find((t) => isStationNavActive(t.href, base, activePath))?.href;
  const selected = tapped ?? current;
  // Switching station keeps the section the admin is looking at.
  const section = station ? activePath.slice(base.length) : '';
  const stations = context.memberships.filter((m) => m.membership.status === 'ACTIVE');

  return (
    <header className="admin-header">
      <div className="admin-header-inner" data-tabs={tabs.length || undefined}>
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
                aria-current={href === current ? 'page' : undefined}
                data-selected={href === selected || undefined}
                onClick={() => {
                  if (href !== current) setTapped(href);
                }}
              >
                <Icon size={19} variant={href === selected ? 'solid' : 'line'} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        )}

        <button
          ref={triggerRef}
          type="button"
          className="admin-header-menu-trigger"
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          aria-label={`תפריט: ${personName}, ${roleText}`}
          onClick={() => setMenuOpen(true)}
        >
          <span className="admin-header-avatar" aria-hidden="true">
            {initials(personName)}
          </span>
          <span className="admin-header-menu-name" aria-hidden="true">
            {personName}
          </span>
          <MenuGlyph size={22} strokeWidth={2} />
        </button>
      </div>

      <div className="admin-menu" data-open={menuOpen || undefined}>
        <button
          type="button"
          className="admin-menu-scrim"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
        />
        <aside
          id={drawerId}
          className="admin-menu-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="תפריט"
          hidden={!menuOpen}
        >
          <div className="admin-menu-head">
            <span className="admin-header-avatar admin-header-avatar--lg" aria-hidden="true">
              {initials(personName)}
            </span>
            <div>
              <strong>{personName}</strong>
              <span>{roleText}</span>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="admin-menu-close"
              aria-label="סגירת התפריט"
              onClick={() => setMenuOpen(false)}
            >
              <CloseGlyph size={20} strokeWidth={2} />
            </button>
          </div>

          {stations.length > 0 && (
            <section className="admin-menu-section" aria-labelledby={`${drawerId}-stations`}>
              <h2 id={`${drawerId}-stations`}>התחנות שלי</h2>
              <ul className="admin-menu-list">
                {stations.map((item) => {
                  const here = station?.id === item.station.id;
                  return (
                    <li key={item.station.id}>
                      <Link
                        href={`/stations/${encodeURIComponent(item.station.code)}${here ? '' : section}`}
                        aria-current={here ? 'true' : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="admin-menu-icon" aria-hidden="true">
                          <CanopyGlyph size={20} variant={here ? 'solid' : 'duo'} />
                        </span>
                        <span className="admin-menu-text">
                          <strong>{item.station.name}</strong>
                          <small>
                            <span className="ys-num" dir="ltr">
                              {item.station.code}
                            </span>
                            {' · '}
                            {roleName(item.membership.role)}
                          </small>
                        </span>
                        {here && <CheckGlyph size={20} strokeWidth={2.4} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {station && !stations.some((m) => m.station.id === station.id) && (
            <section className="admin-menu-section" aria-labelledby={`${drawerId}-current`}>
              <h2 id={`${drawerId}-current`}>התחנה הנוכחית</h2>
              <ul className="admin-menu-list">
                <li>
                  <Link href={base} aria-current="true" onClick={() => setMenuOpen(false)}>
                    <span className="admin-menu-icon" aria-hidden="true">
                      <CanopyGlyph size={20} variant="solid" />
                    </span>
                    <span className="admin-menu-text">
                      <strong>{station.name}</strong>
                      <small className="ys-num" dir="ltr">
                        {station.code}
                      </small>
                    </span>
                  </Link>
                </li>
              </ul>
            </section>
          )}

          {(context.isPlatformAdmin || stations.length > 1) && (
            <Link href="/" className="admin-menu-all" onClick={() => setMenuOpen(false)}>
              כל התחנות
            </Link>
          )}

          <div className="admin-menu-foot">
            <LogoutButton variant="secondary" />
          </div>
        </aside>
      </div>
    </header>
  );
}
