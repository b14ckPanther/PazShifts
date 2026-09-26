'use client';

import { useState } from 'react';
import { NavigationLink as Link } from '@/app/components/NavigationLink';
import { Badge, Button, EmptyState } from '@yellowshifts/ui';
import { UsersIcon, SearchIcon, PhoneIcon } from '@yellowshifts/icons';
import type { StationRole, MembershipStatus, StationMemberWithProfile } from '@yellowshifts/types';
import { MemberDetailsActions } from './MemberDetailsActions';

const ROLE_BADGES: Record<
  StationRole,
  { label: string; variant: 'brandYellow' | 'brandCrimson' | 'neutral' }
> = {
  ADMIN: { label: 'מנהל תחנה', variant: 'brandYellow' },
  SHIFT_MANAGER: { label: 'מנהל משמרת', variant: 'brandCrimson' },
  WORKER: { label: 'עובד', variant: 'neutral' },
};

const STATUS_BADGES: Record<
  MembershipStatus,
  { label: string; variant: 'success' | 'danger' | 'neutral' }
> = {
  ACTIVE: { label: 'פעיל', variant: 'success' },
  INACTIVE: { label: 'לא פעיל', variant: 'neutral' },
  SUSPENDED: { label: 'מושעה', variant: 'danger' },
};

/** Role of a station member, the same in the directory and on the profile. */
export function RoleBadge({ role }: { role: StationRole }) {
  const { label, variant } = ROLE_BADGES[role] ?? ROLE_BADGES.WORKER;
  return <Badge variant={variant}>{label}</Badge>;
}

/** Access status as text + dot (never colour alone), identical in list and profile. */
export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  const { label, variant } = STATUS_BADGES[status] ?? STATUS_BADGES.INACTIVE;
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

function initials(name: string | null | undefined) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join('');
}

interface StaffFilterableListProps {
  stationId: string;
  members: StationMemberWithProfile[];
  canManage: boolean;
  currentUserId: string;
  isPlatformAdmin?: boolean;
}

export function StaffFilterableList({
  stationId,
  members,
  canManage,
  currentUserId,
  isPlatformAdmin = false,
}: StaffFilterableListProps) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<StationRole | 'ALL'>('ALL');
  const [status, setStatus] = useState<MembershipStatus | 'ALL'>('ACTIVE');
  const visible = members.filter(
    ({ membership, profile }) =>
      (role === 'ALL' || role === membership.role) &&
      (status === 'ALL' || status === membership.status) &&
      [profile.fullName, profile.email, membership.employeeCode].some((value) =>
        value?.toLowerCase().includes(search.trim().toLowerCase())
      )
  );
  return (
    <section
      className="admin-section staff-directory"
      aria-labelledby="staff-directory-title"
      dir="rtl"
    >
      <div className="admin-section-header">
        <div>
          <h2 id="staff-directory-title" className="admin-section-title">
            {isPlatformAdmin ? 'צוות והרשאות התחנה' : 'הצוות שלי'}
          </h2>
          <p className="admin-section-description">
            {isPlatformAdmin
              ? 'ניהול מנהלי התחנה, מנהלי המשמרת והעובדים.'
              : 'ניהול העובדים ומנהלי המשמרת. מינוי מנהלי תחנה נעשה על ידי מנהל המערכת הראשי.'}
          </p>
        </div>
        <Badge variant="neutral">
          <span className="ys-num">
            {members.filter((m) => m.membership.status === 'ACTIVE').length}
          </span>{' '}
          פעילים
        </Badge>
      </div>

      <div className="staff-panel">
        <div className="admin-toolbar staff-filters" role="search">
          <label className="ys-form-field staff-search">
            <span className="ys-label">חיפוש בצוות</span>
            <span className="ys-field-control">
              <span className="ys-field-icon ys-field-icon--start" aria-hidden="true">
                <SearchIcon size={18} />
              </span>
              <input
                type="search"
                className="ys-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="שם, אימייל או קוד עובד"
              />
            </span>
          </label>
          <label className="ys-form-field">
            <span className="ys-label">תפקיד</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as StationRole | 'ALL')}
            >
              <option value="ALL">כל התפקידים</option>
              <option value="WORKER">עובדים</option>
              <option value="SHIFT_MANAGER">מנהלי משמרת</option>
              <option value="ADMIN">מנהלי תחנה</option>
            </select>
          </label>
          <label className="ys-form-field">
            <span className="ys-label">גישה לתחנה</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as MembershipStatus | 'ALL')}
            >
              <option value="ACTIVE">פעילים</option>
              <option value="INACTIVE">לא פעילים</option>
              <option value="SUSPENDED">מושעים</option>
              <option value="ALL">כולם</option>
            </select>
          </label>
        </div>

        <p className="staff-result-count" role="status">
          <span className="ys-num">{visible.length}</span> אנשי צוות מוצגים
        </p>

        {visible.length > 0 ? (
          <ul className="staff-rows">
            {visible.map((member) => {
              const { membership, profile } = member;
              return (
                <li
                  className={`staff-row${membership.role === 'ADMIN' ? ' staff-row-admin' : ''}`}
                  key={membership.id}
                >
                  <div className="staff-identity">
                    <span className="staff-avatar" aria-hidden="true">
                      {initials(profile.fullName)}
                    </span>
                    <div className="staff-person">
                      <div className="staff-person-name">
                        <Link href={`/stations/${stationId}/staff/${profile.id}`}>
                          {profile.fullName || 'איש צוות'}
                        </Link>
                        <RoleBadge role={membership.role} />
                        {membership.status !== 'ACTIVE' && (
                          <MembershipStatusBadge status={membership.status} />
                        )}
                      </div>
                      <div className="staff-person-meta">
                        <span dir="auto">{profile.email}</span>
                        {profile.phone && (
                          <span className="staff-person-phone">
                            <PhoneIcon size={13} aria-hidden="true" />
                            <span dir="ltr" className="ys-num">
                              {profile.phone}
                            </span>
                          </span>
                        )}
                        {membership.employeeCode && (
                          <span>
                            קוד עובד: <span dir="auto">{membership.employeeCode}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <MemberDetailsActions
                      stationId={stationId}
                      member={member}
                      currentUserId={currentUserId}
                      isPlatformAdmin={isPlatformAdmin}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            className="staff-empty"
            icon={<UsersIcon size={26} />}
            title="אין אנשי צוות להצגה"
            description="נסו לשנות את החיפוש או להציג את כל מצבי הגישה."
            action={
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setRole('ALL');
                  setStatus('ALL');
                }}
              >
                איפוס סינון
              </Button>
            }
          />
        )}
      </div>
    </section>
  );
}
