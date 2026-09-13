'use client';

import React, { useState, useTransition, useMemo } from 'react';
import type {
  ScheduledShiftWithDetails,
  StationMemberWithProfile,
  StationRole,
  WeeklyAvailabilityWithEntries,
} from '@yellowshifts/types';
import { matchShiftWithAvailability } from '@yellowshifts/database';
import { assignWorkerToShiftAction, removeWorkerFromShiftAction } from '../actions/schedules';
import { Button, Badge } from '@yellowshifts/ui';
import {
  UsersIcon,
  SearchIcon,
  CheckIcon,
  CloseIcon,
  ClockIcon,
  MoonIcon,
  SunIcon,
  UserPlusIcon,
  WarningIcon,
  SuccessIcon,
} from '@yellowshifts/icons';

interface QuickStaffAssignmentDrawerProps {
  stationId: string;
  shift: ScheduledShiftWithDetails;
  activeMembers: StationMemberWithProfile[];
  availabilityRecords?: Record<string, WeeklyAvailabilityWithEntries>;
  canEdit: boolean;
  isDraft: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function QuickStaffAssignmentDrawer({
  stationId,
  shift,
  activeMembers,
  availabilityRecords,
  canEdit,
  isDraft,
  onClose,
  onRefresh,
}: QuickStaffAssignmentDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<StationRole | 'ALL'>('ALL');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [overrideWarning, setOverrideWarning] = useState<{
    membershipId: string;
    workerName: string;
    reason: string;
  } | null>(null);

  // Set of assigned membership IDs on this shift
  const assignedMap = useMemo(() => {
    const map = new Map<string, string>(); // stationMembershipId -> assignmentId
    shift.assignments.forEach((a) => {
      map.set(a.stationMembershipId, a.id);
    });
    return map;
  }, [shift.assignments]);

  // Filtered active members
  const filteredMembers = useMemo(() => {
    return activeMembers.filter((m) => {
      const matchesSearch =
        m.profile.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.membership.employeeCode &&
          m.membership.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole = selectedRole === 'ALL' || m.membership.role === selectedRole;

      return matchesSearch && matchesRole;
    });
  }, [activeMembers, searchQuery, selectedRole]);

  const handleToggleAssignment = (membershipId: string, bypassWarning = false) => {
    if (!canEdit || !isDraft) return;

    const assignmentId = assignedMap.get(membershipId);

    if (assignmentId) {
      // Remove assignment directly
      startTransition(async () => {
        const res = await removeWorkerFromShiftAction(stationId, assignmentId);
        if (res.success) {
          setFeedback({ type: 'success', text: 'שיבוץ העובד הוסר' });
          onRefresh();
        } else {
          setFeedback({ type: 'error', text: res.error || 'שגיאה בהסרת שיבוץ' });
        }
      });
      return;
    }

    // Checking availability guidance
    const memberAvail = availabilityRecords?.[membershipId];
    const match = matchShiftWithAvailability(
      shift.shiftDate,
      shift.startAt,
      shift.endAt,
      memberAvail
    );

    if (!bypassWarning && (match.status === 'UNAVAILABLE' || match.status === 'PARTIAL')) {
      const member = activeMembers.find((m) => m.membership.id === membershipId);
      setOverrideWarning({
        membershipId,
        workerName: member?.profile.fullName || 'עובד',
        reason: match.reason || match.label,
      });
      return;
    }

    setOverrideWarning(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append('stationId', stationId);
      formData.append('scheduledShiftId', shift.id);
      formData.append('stationMembershipId', membershipId);

      const res = await assignWorkerToShiftAction(null, formData);
      if (res.success) {
        setFeedback({ type: 'success', text: 'עובד שובץ למשמרת' });
        onRefresh();
      } else {
        setFeedback({ type: 'error', text: res.error || 'שגיאה בשיבוץ עובד' });
      }
    });
  };

  const sTime = shift.startAt.includes('T')
    ? (shift.startAt.split('T')[1]?.slice(0, 5) ?? '')
    : shift.startAt.slice(11, 16);
  const eTime = shift.endAt.includes('T')
    ? (shift.endAt.split('T')[1]?.slice(0, 5) ?? '')
    : shift.endAt.slice(11, 16);
  const isOvernight = (() => {
    const [sh = 0, sm = 0] = sTime.split(':').map(Number);
    const [eh = 0, em = 0] = eTime.split(':').map(Number);
    return eh < sh || (eh === sh && em <= sm);
  })();

  const roleCount = {
    ADMIN: shift.assignments.filter((a) => a.membership.role === 'ADMIN').length,
    SHIFT_MANAGER: shift.assignments.filter((a) => a.membership.role === 'SHIFT_MANAGER').length,
    WORKER: shift.assignments.filter((a) => a.membership.role === 'WORKER').length,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 110,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          direction: 'rtl',
          overflow: 'hidden',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 800,
                  color: '#111827',
                }}
              >
                {shift.templateName || 'משמרת מותאמת אישית'}
              </span>

              {isOvernight ? (
                <Badge
                  variant="warning"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <MoonIcon size={12} />
                  <span>לילה</span>
                </Badge>
              ) : (
                <Badge
                  variant="neutral"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <SunIcon size={12} />
                  <span>יום</span>
                </Badge>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.875rem',
                color: '#D97706',
                fontWeight: 600,
              }}
            >
              <ClockIcon size={16} />
              <span>
                <bdi dir="ltr">{shift.shiftDate}</bdi> •{' '}
                <bdi dir="ltr">{`${sTime} — ${eTime}`}</bdi>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Current Team Overview Bar */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: '#F9FAFB',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8125rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4B5563' }}>
            <UsersIcon size={16} style={{ color: 'var(--ys-color-brand-yellow)' }} />
            <span>צוות משובץ:</span>
            <strong style={{ color: '#111827' }}>{shift.assignments.length} עובדים</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {roleCount.ADMIN > 0 && <Badge variant="neutral">מנהל ({roleCount.ADMIN})</Badge>}
            {roleCount.SHIFT_MANAGER > 0 && (
              <Badge variant="neutral">אחמ״ש ({roleCount.SHIFT_MANAGER})</Badge>
            )}
            {roleCount.WORKER > 0 && <Badge variant="neutral">עובד ({roleCount.WORKER})</Badge>}
          </div>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            style={{
              margin: '12px 24px 0',
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: feedback.type === 'success' ? '#065F46' : '#991B1B',
              border: feedback.type === 'success' ? '1px solid #A7F3D0' : '1px solid #FECACA',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {feedback.type === 'success' ? <SuccessIcon size={16} /> : <WarningIcon size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Search & Role Filter Tabs */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB' }}>
          {/* Search Box */}
          <div
            style={{
              position: 'relative',
              marginBottom: '12px',
            }}
          >
            <SearchIcon
              size={16}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6B7280',
              }}
            />
            <input
              type="text"
              placeholder="חיפוש איש צוות לפי שם או קוד עובד..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                padding: '10px 36px 10px 12px',
                color: '#111827',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* Role Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(
              [
                { role: 'ALL', label: 'הכל' },
                { role: 'ADMIN', label: 'מנהלי תחנה' },
                { role: 'SHIFT_MANAGER', label: 'מנהלי משמרת' },
                { role: 'WORKER', label: 'עובדים' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.role}
                onClick={() => setSelectedRole(tab.role)}
                style={{
                  backgroundColor:
                    selectedRole === tab.role ? 'var(--ys-color-brand-yellow)' : '#F3F4F6',
                  color: selectedRole === tab.role ? '#111827' : '#4B5563',
                  border:
                    selectedRole === tab.role
                      ? '1px solid var(--ys-color-brand-yellow)'
                      : '1px solid #E5E7EB',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  fontWeight: selectedRole === tab.role ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Override Availability Warning Banner */}
        {overrideWarning && (
          <div
            style={{
              backgroundColor: '#FEFCE8',
              border: '1px solid #FEF08A',
              borderRadius: '8px',
              padding: '12px 16px',
              margin: '12px 24px 0',
              color: '#854D0E',
              direction: 'rtl',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <WarningIcon
                size={18}
                style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }}
              />
              <div style={{ flex: 1 }}>
                <strong
                  style={{
                    fontSize: '0.875rem',
                    color: '#854D0E',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  אזהרת שיבוץ מחוץ לזמינות
                </strong>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: '#713F12',
                    margin: '0 0 10px 0',
                    lineHeight: '1.4',
                  }}
                >
                  העובד <strong>{overrideWarning.workerName}</strong> הצהיר על אי-זמינות (
                  {overrideWarning.reason}). האם לשבץ בכל זאת?
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    size="sm"
                    variant="brandYellow"
                    onClick={() => handleToggleAssignment(overrideWarning.membershipId, true)}
                    disabled={isPending}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 12px',
                      color: '#111827',
                      fontWeight: 700,
                    }}
                  >
                    שבץ בכל זאת
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setOverrideWarning(null)}
                    disabled={isPending}
                    style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                  >
                    ביטול
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Member List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {filteredMembers.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: '#6B7280',
                fontSize: '0.875rem',
              }}
            >
              לא נמצאו אנשי צוות מתאימים
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredMembers.map((member) => {
                const isAssigned = assignedMap.has(member.membership.id);
                const memberAvail = availabilityRecords?.[member.membership.id];
                const match = matchShiftWithAvailability(
                  shift.shiftDate,
                  shift.startAt,
                  shift.endAt,
                  memberAvail
                );

                return (
                  <div
                    key={member.membership.id}
                    style={{
                      backgroundColor: isAssigned ? '#F0FDF4' : '#FFFFFF',
                      border: isAssigned ? '1px solid #BBF7D0' : '1px solid #E5E7EB',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: isAssigned ? '#16A34A' : '#F3F4F6',
                          color: isAssigned ? '#FFFFFF' : '#374151',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                        }}
                      >
                        {member.profile.fullName.slice(0, 1)}
                      </div>

                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}
                          >
                            {member.profile.fullName}
                          </span>
                          <Badge variant="neutral" style={{ fontSize: '0.6875rem' }}>
                            {member.membership.role === 'ADMIN'
                              ? 'מנהל תחנה'
                              : member.membership.role === 'SHIFT_MANAGER'
                                ? 'אחמ״ש'
                                : 'עובד'}
                          </Badge>

                          {/* Availability Guidance Badge */}
                          {match.status === 'AVAILABLE' && (
                            <Badge
                              variant="success"
                              style={{ fontSize: '0.6875rem' }}
                              title={match.reason}
                            >
                              זמין
                            </Badge>
                          )}
                          {match.status === 'PARTIAL' && (
                            <Badge
                              variant="warning"
                              style={{ fontSize: '0.6875rem' }}
                              title={match.reason}
                            >
                              זמין חלקית
                            </Badge>
                          )}
                          {match.status === 'UNAVAILABLE' && (
                            <Badge
                              variant="danger"
                              style={{ fontSize: '0.6875rem' }}
                              title={match.reason}
                            >
                              לא זמין
                            </Badge>
                          )}
                          {match.status === 'NOT_SUBMITTED' && (
                            <Badge
                              variant="neutral"
                              style={{ fontSize: '0.6875rem', opacity: 0.65 }}
                            >
                              טרם הוגש
                            </Badge>
                          )}
                        </div>
                        {member.membership.employeeCode && (
                          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '2px' }}>
                            קוד: {member.membership.employeeCode}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      {canEdit && isDraft ? (
                        <Button
                          variant={isAssigned ? 'secondary' : 'primary'}
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleToggleAssignment(member.membership.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            minWidth: '76px',
                            justifyContent: 'center',
                          }}
                        >
                          {isAssigned ? (
                            <>
                              <CloseIcon size={14} />
                              <span>הסר</span>
                            </>
                          ) : (
                            <>
                              <UserPlusIcon size={14} />
                              <span>שבץ</span>
                            </>
                          )}
                        </Button>
                      ) : (
                        isAssigned && (
                          <Badge
                            variant="success"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <CheckIcon size={12} />
                            <span>משובץ</span>
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            סגירה
          </Button>
        </div>
      </div>
    </div>
  );
}
