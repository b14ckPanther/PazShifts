'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@yellowshifts/ui';
import { UsersIcon, ShieldCheckIcon } from '@yellowshifts/icons';
import type { StationMemberWithProfile, StationRole, MembershipStatus } from '@yellowshifts/types';
import { MemberDetailsActions } from './MemberDetailsActions';

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
    <section className="staff-directory" aria-label="צוות התחנה" dir="rtl">
      <div className="staff-directory-heading">
        <div>
          <h2>
            <UsersIcon size={22} />
            {isPlatformAdmin ? 'צוות והרשאות התחנה' : 'הצוות שלי'}
          </h2>
          <p>
            {isPlatformAdmin
              ? 'ניהול מנהלי התחנה, מנהלי המשמרת והעובדים.'
              : 'ניהול העובדים ומנהלי המשמרת. מינוי מנהלי תחנה נעשה על ידי מנהל המערכת הראשי.'}
          </p>
        </div>
        <Badge variant="neutral">
          {members.filter((m) => m.membership.status === 'ACTIVE').length} פעילים
        </Badge>
      </div>
      <div className="staff-filters">
        <label className="staff-search">
          חיפוש בצוות
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="שם, אימייל או קוד עובד"
          />
        </label>
        <label>
          תפקיד
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
        <label>
          גישה לתחנה
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
      <div className="staff-result-count" role="status">
        {visible.length} אנשי צוות מוצגים
      </div>
      <div className="staff-rows">
        {visible.map((member) => {
          const { membership, profile } = member;
          return (
            <article
              className={`staff-row ${membership.role === 'ADMIN' ? 'staff-row-admin' : ''}`}
              key={membership.id}
            >
              <div className="staff-identity">
                <div className="staff-avatar" aria-hidden="true">
                  {membership.role === 'ADMIN' ? (
                    <ShieldCheckIcon size={23} />
                  ) : (
                    (profile.fullName || '?').slice(0, 1)
                  )}
                </div>
                <div className="staff-person">
                  <Link href={`/stations/${stationId}/staff/${profile.id}`}>
                    {profile.fullName || 'איש צוות'}
                  </Link>
                  <div className="staff-person-meta">
                    <span dir="auto">{profile.email}</span>
                    {membership.employeeCode && <span>קוד עובד: {membership.employeeCode}</span>}
                  </div>
                  <div className="staff-badges">
                    <Badge
                      variant={
                        membership.role === 'ADMIN'
                          ? 'brandYellow'
                          : membership.role === 'SHIFT_MANAGER'
                            ? 'brandCrimson'
                            : 'neutral'
                      }
                    >
                      {membership.role === 'ADMIN'
                        ? 'מנהל תחנה'
                        : membership.role === 'SHIFT_MANAGER'
                          ? 'מנהל משמרת'
                          : 'עובד'}
                    </Badge>
                    {membership.status !== 'ACTIVE' && (
                      <Badge variant="neutral">
                        {membership.status === 'INACTIVE' ? 'לא פעיל' : 'מושעה'}
                      </Badge>
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
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <div className="staff-empty">
          <UsersIcon size={30} />
          <h3>אין אנשי צוות להצגה</h3>
          <p>נסו לשנות את החיפוש או להציג את כל מצבי הגישה.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              setRole('ALL');
              setStatus('ALL');
            }}
          >
            איפוס סינון
          </Button>
        </div>
      )}
    </section>
  );
}
