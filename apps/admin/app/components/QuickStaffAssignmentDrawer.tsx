'use client';

import React, { useId, useState, useTransition, useMemo } from 'react';
import type {
  ScheduledShiftWithDetails,
  StationMemberWithProfile,
  StationRole,
  WeeklyAvailabilityWithEntries,
  ShiftAssignmentWithProfile,
} from '@yellowshifts/types';
import { matchShiftWithAvailability } from '@yellowshifts/database';
import { countText } from './WeeklyScheduleGrid';
import { assignWorkerToShiftAction, removeWorkerFromShiftAction } from '../actions/schedules';
import { Button, Badge, Dialog } from '@yellowshifts/ui';
import {
  UsersIcon,
  SearchIcon,
  CheckIcon,
  CloseIcon,
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
  onRefresh?: () => void;
  onOptimisticAssign?: (
    shiftId: string,
    member: StationMemberWithProfile,
    tempAssignmentId: string
  ) => void;
  onReconcileAssign?: (
    shiftId: string,
    tempAssignmentId: string,
    realAssignment: ShiftAssignmentWithProfile
  ) => void;
  onRollbackAssign?: (shiftId: string, tempAssignmentId: string) => void;
  onOptimisticRemove?: (shiftId: string, assignmentId: string) => void;
  onRollbackRemove?: (shiftId: string, removedAssignment: ShiftAssignmentWithProfile) => void;
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
  onOptimisticAssign,
  onReconcileAssign,
  onRollbackAssign,
  onOptimisticRemove,
  onRollbackRemove,
}: QuickStaffAssignmentDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<StationRole | 'ALL'>('ALL');
  const [, startTransition] = useTransition();
  const fieldId = useId();
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<string>>(new Set());
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
      // Remove assignment directly with immediate optimistic update
      const assignmentToRemove = shift.assignments.find((a) => a.id === assignmentId);
      onOptimisticRemove?.(shift.id, assignmentId);

      setPendingMemberIds((prev) => new Set(prev).add(membershipId));

      startTransition(async () => {
        try {
          const res = await removeWorkerFromShiftAction(stationId, assignmentId);
          if (res.success) {
            setFeedback({ type: 'success', text: 'שיבוץ העובד הוסר' });
            if (onRefresh && !onOptimisticRemove) onRefresh();
          } else {
            if (assignmentToRemove) {
              onRollbackRemove?.(shift.id, assignmentToRemove);
            }
            setFeedback({ type: 'error', text: res.error || 'שגיאה בהסרת שיבוץ' });
          }
        } catch {
          if (assignmentToRemove) {
            onRollbackRemove?.(shift.id, assignmentToRemove);
          }
          setFeedback({ type: 'error', text: 'שגיאה בהסרת שיבוץ' });
        } finally {
          setPendingMemberIds((prev) => {
            const next = new Set(prev);
            next.delete(membershipId);
            return next;
          });
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

    const memberToAssign = activeMembers.find((m) => m.membership.id === membershipId);
    if (!memberToAssign) return;

    const tempId = 'temp-' + Math.random().toString(36).slice(2);
    onOptimisticAssign?.(shift.id, memberToAssign, tempId);

    setPendingMemberIds((prev) => new Set(prev).add(membershipId));

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('stationId', stationId);
        formData.append('scheduledShiftId', shift.id);
        formData.append('stationMembershipId', membershipId);

        const res = await assignWorkerToShiftAction(null, formData);
        if (res.success && res.assignment) {
          onReconcileAssign?.(shift.id, tempId, res.assignment);
          setFeedback({ type: 'success', text: 'עובד שובץ למשמרת' });
          if (onRefresh && !onOptimisticAssign) onRefresh();
        } else {
          onRollbackAssign?.(shift.id, tempId);
          setFeedback({ type: 'error', text: res.error || 'שגיאה בשיבוץ עובד' });
        }
      } catch {
        onRollbackAssign?.(shift.id, tempId);
        setFeedback({ type: 'error', text: 'שגיאה בשיבוץ עובד' });
      } finally {
        setPendingMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(membershipId);
          return next;
        });
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

  const roleLabel = (role: StationRole) =>
    role === 'ADMIN' ? 'מנהל תחנה' : role === 'SHIFT_MANAGER' ? 'אחמ״ש' : 'עובד';

  return (
    <Dialog
      open
      onClose={onClose}
      className="schedule-assign-sheet"
      title={shift.templateName || 'משמרת מותאמת אישית'}
      description={
        <span className="schedule-assign-meta">
          <span className={`schedule-shift-kind${isOvernight ? ' is-night' : ''}`}>
            {isOvernight ? (
              <MoonIcon size={12} aria-hidden="true" />
            ) : (
              <SunIcon size={12} aria-hidden="true" />
            )}
            {isOvernight ? 'לילה' : 'יום'}
          </span>
          <span className="ys-num">
            <bdi dir="ltr">{shift.shiftDate}</bdi> · <bdi dir="ltr">{`${sTime}–${eTime}`}</bdi>
          </span>
        </span>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          סגירה
        </Button>
      }
    >
      {/* Team summary, search and role filter stay visible while the list scrolls */}
      <div className="schedule-assign-controls">
        <div className="schedule-assign-team">
          <span>
            <UsersIcon size={16} aria-hidden="true" />
            צוות משובץ: <strong>{countText(shift.assignments.length, 'עובד אחד', 'עובדים')}</strong>
          </span>
          <span className="schedule-assign-roles">
            {roleCount.ADMIN > 0 && <Badge variant="neutral">מנהל ({roleCount.ADMIN})</Badge>}
            {roleCount.SHIFT_MANAGER > 0 && (
              <Badge variant="neutral">אחמ״ש ({roleCount.SHIFT_MANAGER})</Badge>
            )}
            {roleCount.WORKER > 0 && <Badge variant="neutral">עובד ({roleCount.WORKER})</Badge>}
          </span>
        </div>

        <div className="ys-form-field schedule-assign-search">
          <label className="ys-label" htmlFor={`${fieldId}-search`}>
            חיפוש איש צוות
          </label>
          <div className="ys-field-control">
            <span className="ys-field-icon ys-field-icon--start" aria-hidden="true">
              <SearchIcon size={16} />
            </span>
            <input
              id={`${fieldId}-search`}
              className="ys-input"
              type="search"
              placeholder="שם או קוד עובד"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div
          className="ys-segmented schedule-assign-filter"
          role="group"
          aria-label="סינון לפי תפקיד"
        >
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
              type="button"
              aria-pressed={selectedRole === tab.role}
              onClick={() => setSelectedRole(tab.role)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="schedule-assign-notices">
        {feedback && (
          <p
            className={`admin-feedback admin-feedback--${feedback.type}`}
            role={feedback.type === 'success' ? 'status' : 'alert'}
          >
            {feedback.type === 'success' ? (
              <SuccessIcon size={18} aria-hidden="true" />
            ) : (
              <WarningIcon size={18} aria-hidden="true" />
            )}
            <span>{feedback.text}</span>
          </p>
        )}

        {/* Assigning outside the worker's declared availability needs confirmation */}
        {overrideWarning && (
          <div className="schedule-assign-override" role="alert">
            <p className="schedule-assign-override-title">
              <WarningIcon size={18} aria-hidden="true" />
              אזהרת שיבוץ מחוץ לזמינות
            </p>
            <p>
              העובד <strong>{overrideWarning.workerName}</strong> הצהיר על אי-זמינות (
              {overrideWarning.reason}). האם לשבץ בכל זאת?
            </p>
            <div className="schedule-assign-override-actions">
              <Button
                variant="primary"
                onClick={() => handleToggleAssignment(overrideWarning.membershipId, true)}
                disabled={pendingMemberIds.has(overrideWarning.membershipId)}
              >
                שבץ בכל זאת
              </Button>
              <Button
                variant="secondary"
                onClick={() => setOverrideWarning(null)}
                disabled={pendingMemberIds.has(overrideWarning.membershipId)}
              >
                ביטול
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Member list */}
      {filteredMembers.length === 0 ? (
        <p className="schedule-assign-empty">לא נמצאו אנשי צוות מתאימים</p>
      ) : (
        <ul className="schedule-assign-list" aria-label="אנשי צוות">
          {filteredMembers.map((member) => {
            const isAssigned = assignedMap.has(member.membership.id);
            const memberAvail = availabilityRecords?.[member.membership.id];
            const match = matchShiftWithAvailability(
              shift.shiftDate,
              shift.startAt,
              shift.endAt,
              memberAvail
            );
            const isConflict = match.status === 'PARTIAL' || match.status === 'UNAVAILABLE';

            return (
              <li
                key={member.membership.id}
                className={`schedule-assign-member${isAssigned ? ' is-assigned' : ''}`}
              >
                <span className="schedule-assign-avatar" aria-hidden="true">
                  {member.profile.fullName.slice(0, 1)}
                </span>

                <div className="schedule-assign-member-body">
                  <div className="schedule-assign-member-name">
                    <strong>{member.profile.fullName}</strong>
                    <Badge variant="neutral">{roleLabel(member.membership.role)}</Badge>

                    {/* Availability guidance */}
                    {match.status === 'AVAILABLE' && <Badge variant="success">זמין</Badge>}
                    {match.status === 'PARTIAL' && <Badge variant="warning">זמין חלקית</Badge>}
                    {match.status === 'UNAVAILABLE' && <Badge variant="danger">לא זמין</Badge>}
                    {match.status === 'NOT_SUBMITTED' && <Badge variant="neutral">טרם הוגש</Badge>}
                  </div>
                  {member.membership.employeeCode && (
                    <span className="schedule-assign-member-code">
                      קוד: <span className="ys-num">{member.membership.employeeCode}</span>
                    </span>
                  )}
                  {match.reason && match.status !== 'NOT_SUBMITTED' && (
                    <span className={`schedule-assign-reason${isConflict ? ' is-conflict' : ''}`}>
                      {match.reason}
                    </span>
                  )}
                </div>

                <div className="schedule-assign-member-action">
                  {canEdit && isDraft ? (
                    <Button
                      variant={isAssigned ? 'secondary' : 'primary'}
                      disabled={pendingMemberIds.has(member.membership.id)}
                      onClick={() => handleToggleAssignment(member.membership.id)}
                      rightIcon={isAssigned ? <CloseIcon size={14} /> : <UserPlusIcon size={14} />}
                      aria-label={`${isAssigned ? 'הסרת' : 'שיבוץ'} ${member.profile.fullName}`}
                    >
                      {isAssigned ? 'הסר' : 'שבץ'}
                    </Button>
                  ) : (
                    isAssigned && (
                      <Badge variant="success">
                        <CheckIcon size={12} aria-hidden="true" />
                        <span>משובץ</span>
                      </Badge>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
