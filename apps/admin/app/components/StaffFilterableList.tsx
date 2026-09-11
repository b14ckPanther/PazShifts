'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, Badge, Button, Input } from '@yellowshifts/ui';
import {
  UsersIcon,
  SearchIcon,
  ShieldCheckIcon,
  EditIcon,
  PowerIcon,
  UserIcon,
} from '@yellowshifts/icons';
import type { StationMemberWithProfile, StationRole, MembershipStatus } from '@yellowshifts/types';
import { RoleModal, StatusModal } from './MemberActionModals';
import { RemoveMemberButton } from './RemoveMemberButton';

interface StaffFilterableListProps {
  stationId: string;
  members: StationMemberWithProfile[];
  canManage: boolean;
}

export const StaffFilterableList: React.FC<StaffFilterableListProps> = ({
  stationId,
  members,
  canManage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<StationRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | 'ALL'>('ALL');
  const [activeRoleMember, setActiveRoleMember] = useState<StationMemberWithProfile | null>(null);
  const [activeStatusMember, setActiveStatusMember] = useState<StationMemberWithProfile | null>(
    null
  );

  const filteredMembers = useMemo(() => {
    return members.filter((item) => {
      // Role filter
      if (roleFilter !== 'ALL' && item.membership.role !== roleFilter) return false;

      // Status filter
      if (statusFilter !== 'ALL' && item.membership.status !== statusFilter) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const matchName = item.profile.fullName.toLowerCase().includes(q);
      const matchEmail = item.profile.email?.toLowerCase().includes(q) ?? false;
      const matchCode = item.membership.employeeCode?.toLowerCase().includes(q) ?? false;
      const matchPhone = item.profile.phone?.includes(q) ?? false;

      return matchName || matchEmail || matchCode || matchPhone;
    });
  }, [members, searchQuery, roleFilter, statusFilter]);

  if (members.length === 0) {
    return (
      <Card>
        <CardContent>
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--ys-color-brand-yellow-subtle, #FEF3C7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ys-color-text-primary, #111827)',
              }}
            >
              <UsersIcon size={28} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--ys-color-text-primary, #111827)',
                  margin: 0,
                }}
              >
                טרם הוקצו אנשי צוות לתחנה זו
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--ys-color-text-secondary, #6B7280)',
                  margin: '6px 0 0 0',
                }}
              >
                השתמש בטופס שלמעלה כדי להקצות מנהל תחנה, מנהל משמרת או עובד ראשון.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Search and Filters Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: 'var(--ys-color-surface-raised, #FFFFFF)',
          padding: '16px',
          borderRadius: 'var(--ys-radius-md)',
          border: '1px solid var(--ys-color-border-subtle, #E5E7EB)',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Input
            id="staff-search"
            type="text"
            placeholder="חיפוש לפי שם, כתובת אימייל, טלפון או קוד עובד..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Role Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--ys-color-text-secondary, #6B7280)',
                marginLeft: '6px',
              }}
            >
              תפקיד:
            </span>
            <Button
              variant={roleFilter === 'ALL' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setRoleFilter('ALL')}
            >
              הכל ({members.length})
            </Button>
            <Button
              variant={roleFilter === 'ADMIN' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setRoleFilter('ADMIN')}
            >
              מנהלי תחנה ({members.filter((m) => m.membership.role === 'ADMIN').length})
            </Button>
            <Button
              variant={roleFilter === 'SHIFT_MANAGER' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setRoleFilter('SHIFT_MANAGER')}
            >
              מנהלי משמרת ({members.filter((m) => m.membership.role === 'SHIFT_MANAGER').length})
            </Button>
            <Button
              variant={roleFilter === 'WORKER' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setRoleFilter('WORKER')}
            >
              עובדים ({members.filter((m) => m.membership.role === 'WORKER').length})
            </Button>
          </div>

          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#888890', marginLeft: '6px' }}>סטטוס:</span>
            <Button
              variant={statusFilter === 'ALL' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('ALL')}
            >
              הכל
            </Button>
            <Button
              variant={statusFilter === 'ACTIVE' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('ACTIVE')}
            >
              פעילים ({members.filter((m) => m.membership.status === 'ACTIVE').length})
            </Button>
            <Button
              variant={statusFilter === 'INACTIVE' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('INACTIVE')}
            >
              לא פעילים ({members.filter((m) => m.membership.status === 'INACTIVE').length})
            </Button>
            <Button
              variant={statusFilter === 'SUSPENDED' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('SUSPENDED')}
            >
              מושעים ({members.filter((m) => m.membership.status === 'SUSPENDED').length})
            </Button>
          </div>
        </div>
      </div>

      {/* Results Count / Empty Search State */}
      {filteredMembers.length === 0 ? (
        <Card>
          <CardContent>
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--ys-color-text-secondary, #6B7280)',
              }}
            >
              <SearchIcon size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div>לא נמצאו אנשי צוות התואמים את החיפוש או הסינון.</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredMembers.map((item) => {
            const { membership, profile } = item;

            return (
              <div
                key={membership.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  backgroundColor: 'var(--ys-color-surface-raised, #FFFFFF)',
                  border: '1px solid var(--ys-color-border-subtle, #E5E7EB)',
                  borderRadius: 'var(--ys-radius-sm)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                {/* Member Identity & Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--ys-color-surface-muted, #F3F4F6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color:
                        membership.role === 'ADMIN'
                          ? '#B45309'
                          : membership.role === 'SHIFT_MANAGER'
                            ? 'var(--ys-color-brand-crimson)'
                            : 'var(--ys-color-text-secondary, #6B7280)',
                    }}
                  >
                    {membership.role === 'ADMIN' ? (
                      <ShieldCheckIcon size={20} />
                    ) : (
                      <UserIcon size={20} />
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Link
                        href={`/stations/${stationId}/staff/${profile.id}`}
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: 'var(--ys-color-text-primary, #111827)',
                          textDecoration: 'none',
                        }}
                      >
                        {profile.fullName || 'משתמש ללא שם'}
                      </Link>

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
                          ? 'מנהל תחנה (ADMIN)'
                          : membership.role === 'SHIFT_MANAGER'
                            ? 'מנהל משמרת'
                            : 'עובד'}
                      </Badge>

                      <Badge
                        variant={
                          membership.status === 'ACTIVE'
                            ? 'success'
                            : membership.status === 'SUSPENDED'
                              ? 'danger'
                              : 'neutral'
                        }
                        dot
                      >
                        {membership.status === 'ACTIVE'
                          ? 'פעיל'
                          : membership.status === 'SUSPENDED'
                            ? 'מושעה'
                            : 'לא פעיל'}
                      </Badge>
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--ys-color-text-secondary, #6B7280)',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>{profile.email}</span>
                      {profile.phone && <span>טלפון: {profile.phone}</span>}
                      {membership.employeeCode && (
                        <span>
                          קוד עובד: <strong>{membership.employeeCode}</strong>
                        </span>
                      )}
                      <span>
                        הצטרף: {new Date(membership.createdAt).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Link
                    href={`/stations/${stationId}/staff/${profile.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="ghost" size="sm" title="פרטי איש צוות">
                      פרטים
                    </Button>
                  </Link>

                  {canManage && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveRoleMember(item)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <EditIcon size={14} />
                        <span>תפקיד</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveStatusMember(item)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <PowerIcon size={14} />
                        <span>סטטוס</span>
                      </Button>

                      <RemoveMemberButton
                        stationId={stationId}
                        membershipId={membership.id}
                        memberName={profile.fullName || profile.email || 'איש צוות'}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role Change Modal */}
      {activeRoleMember && (
        <RoleModal
          stationId={stationId}
          member={activeRoleMember}
          isOpen={Boolean(activeRoleMember)}
          onClose={() => setActiveRoleMember(null)}
        />
      )}

      {/* Status Change Modal */}
      {activeStatusMember && (
        <StatusModal
          stationId={stationId}
          member={activeStatusMember}
          isOpen={Boolean(activeStatusMember)}
          onClose={() => setActiveStatusMember(null)}
        />
      )}
    </div>
  );
};
