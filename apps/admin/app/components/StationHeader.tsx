'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Container, Badge, BrandMark } from '@yellowshifts/ui';
import { UserIcon } from '@yellowshifts/icons';
import type { AuthenticatedUserContext } from '@yellowshifts/types';
import { LogoutButton } from './LogoutButton';
import './station-header.css';

interface StationHeaderProps {
  station: {
    id: string;
    name: string;
    code: string;
  };
  context: AuthenticatedUserContext;
  pageTitle?: string;
  subtitle?: string;
}

export const StationHeader: React.FC<StationHeaderProps> = ({
  station,
  context,
  pageTitle,
  subtitle,
}) => {
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!headerRef.current) return;
    const updateHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(headerRef.current);
    window.addEventListener('resize', updateHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const personName =
    context.profile?.fullName?.trim() ||
    context.user.email?.split('@')[0] ||
    (context.isPlatformAdmin ? 'מנהל פלטפורמה' : 'מנהל תחנה');

  const roleText = context.isPlatformAdmin ? 'מנהל פלטפורמה' : 'מנהל תחנה';
  const roleVariant = context.isPlatformAdmin ? 'brandCrimson' : 'brandYellow';

  const canonicalCode = encodeURIComponent(station.code);
  const resolvedSubtitle =
    subtitle || (pageTitle ? `קוד תחנה: ${station.code} • ${pageTitle}` : `קוד תחנה: ${station.code} • YellowShifts`);

  return (
    <>
      <header
        ref={headerRef}
        className="station-header-root"
        style={{
          backgroundColor: '#fcbc00',
          background: '#fcbc00',
        }}
      >
      <Container size="lg">
        <div className="station-header-inner">
          <div className="station-header-main-row">
            <div className="station-header-brand-section">
              <Link
                href={`/stations/${canonicalCode}`}
                className="station-header-logo-link"
                title="חזרה לדשבורד התחנה"
              >
                <div className="station-header-logo-badge">
                  <BrandMark size={32} />
                </div>
              </Link>
              <div className="station-header-titles">
                <h2 className="station-header-title">{station.name}</h2>
                <p className="station-header-subtitle">
                  {resolvedSubtitle.includes(station.code) ? (
                    resolvedSubtitle
                  ) : (
                    <>
                      קוד תחנה: <span className="station-header-code-tag">{station.code}</span> •{' '}
                      {resolvedSubtitle}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="station-header-actions-section">
              {/* Desktop user card */}
              <div className="station-header-user-chip">
                <div className="station-header-user-avatar" aria-hidden="true">
                  <UserIcon size={14} />
                </div>
                <div className="station-header-user-meta">
                  <span className="station-header-user-name">{personName}</span>
                  <span className="station-header-user-role-label">{roleText}</span>
                </div>
                <Badge variant={roleVariant} dot>
                  {roleText}
                </Badge>
              </div>

              <LogoutButton variant="outline" />
            </div>
          </div>

          {/* Mobile full-width user bar */}
          <div className="station-header-mobile-strip">
            <div className="station-header-mobile-user">
              <div className="station-header-user-avatar" aria-hidden="true">
                <UserIcon size={13} />
              </div>
              <span className="station-header-mobile-greeting">שלום,</span>
              <span className="station-header-mobile-name">{personName}</span>
            </div>
            <Badge variant={roleVariant} dot>
              {roleText}
            </Badge>
          </div>
        </div>
      </Container>
    </header>
    <div
      className="station-header-spacer"
      style={{ height: headerHeight ? `${headerHeight}px` : undefined }}
      aria-hidden="true"
    />
  </>
  );
};

