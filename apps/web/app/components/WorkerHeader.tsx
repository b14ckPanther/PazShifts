'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BrandMark, Container, Badge } from '@yellowshifts/ui';
import { HomeIcon, UserIcon, BriefcaseIcon, CalendarIcon, ClockIcon } from '@yellowshifts/icons';
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

  const personName = profile?.fullName?.trim() || user.email?.split('@')[0] || 'עובד';

  const roleText = isPlatformAdmin
    ? 'מנהל מערכת ראשי'
    : role === 'ADMIN'
      ? 'מנהל תחנה'
      : role === 'SHIFT_MANAGER'
        ? 'מנהל משמרת'
        : 'עובד תחנה';

  const canonicalCode = encodeURIComponent(station.code);
  const resolvedSubtitle =
    subtitle ||
    (pageTitle ? `קוד תחנה: ${station.code} • ${pageTitle}` : `קוד תחנה: ${station.code}`);

  return (
    <>
      <header
        ref={headerRef}
        className="worker-header-root"
        style={{
          backgroundColor: '#fcbc00',
          background: '#fcbc00',
        }}
      >
        <Container size="lg">
          <div className="worker-header-inner">
            <div className="worker-header-main-row">
              <div className="worker-header-brand-section">
                <Link
                  href={`/stations/${canonicalCode}`}
                  className="worker-header-logo-link"
                  title="דף הבית של המשמרות שלי"
                >
                  <div className="worker-header-logo-badge">
                    <BrandMark size={28} />
                  </div>
                </Link>
                <div className="worker-header-titles">
                  <h2 className="worker-header-title">{station.name}</h2>
                  <p className="worker-header-subtitle">
                    {resolvedSubtitle.includes(station.code) ? (
                      resolvedSubtitle
                    ) : (
                      <>
                        קוד תחנה: <span className="worker-header-code-tag">{station.code}</span> •{' '}
                        {resolvedSubtitle}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Desktop-only Navigation Tabs (hidden on mobile; mobile dock is used instead) */}
              <nav className="worker-header-nav-tabs" aria-label="ניווט ראשי למחשב">
                <Link
                  href={`/stations/${canonicalCode}/home`}
                  className={`worker-header-tab-link ${activeTab === 'home' ? 'is-active' : ''}`}
                >
                  <HomeIcon size={15} />
                  <span>הבית שלי</span>
                </Link>
                <Link
                  href={`/stations/${canonicalCode}`}
                  className={`worker-header-tab-link ${activeTab === 'shifts' ? 'is-active' : ''}`}
                >
                  <BriefcaseIcon size={15} />
                  <span>המשמרות שלי</span>
                </Link>
                <Link
                  href={`/stations/${canonicalCode}/availability`}
                  className={`worker-header-tab-link ${activeTab === 'availability' ? 'is-active' : ''}`}
                >
                  <CalendarIcon size={15} />
                  <span>הזמינות שלי</span>
                </Link>
                <Link
                  href={`/stations/${canonicalCode}/hours`}
                  className={`worker-header-tab-link ${activeTab === 'hours' ? 'is-active' : ''}`}
                >
                  <ClockIcon size={15} />
                  <span>השעות שלי</span>
                </Link>
              </nav>

              <div className="worker-header-actions-section">
                {/* Desktop user chip */}
                <div className="worker-header-user-chip">
                  <div className="worker-header-user-avatar" aria-hidden="true">
                    <UserIcon size={14} />
                  </div>
                  <div className="worker-header-user-meta">
                    <span className="worker-header-user-name">{personName}</span>
                    <span className="worker-header-user-role-label">{roleText}</span>
                  </div>
                  <Badge variant="brandYellow" dot>
                    {roleText}
                  </Badge>
                </div>

                <LogoutButton variant="outline" />
              </div>
            </div>

            {/* Mobile full-width user bar */}
            <div className="worker-header-mobile-strip">
              <div className="worker-header-mobile-user">
                <div className="worker-header-user-avatar" aria-hidden="true">
                  <UserIcon size={13} />
                </div>
                <span className="worker-header-mobile-greeting">שלום,</span>
                <span className="worker-header-mobile-name">{personName}</span>
              </div>
              <Badge variant="brandYellow" dot>
                {roleText}
              </Badge>
            </div>
          </div>
        </Container>
      </header>
      <div
        className="worker-header-spacer"
        style={{ height: headerHeight ? `${headerHeight}px` : undefined }}
        aria-hidden="true"
      />
    </>
  );
};
