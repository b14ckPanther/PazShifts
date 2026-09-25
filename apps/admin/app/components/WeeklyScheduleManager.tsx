'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type {
  WeeklyScheduleDetails,
  ShiftTemplate,
  StationMemberWithProfile,
  ScheduledShiftWithDetails,
  CopyWeekResult,
  WeeklyAvailabilityWithEntries,
  ShiftAssignmentWithProfile,
} from '@yellowshifts/types';
import {
  createWeeklyScheduleAction,
  deleteScheduledShiftAction,
  revertScheduleToDraftAction,
} from '../actions/schedules';
import { Card, CardContent, Button, Badge } from '@yellowshifts/ui';
import {
  CalendarIcon,
  PlusIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  SendIcon,
  WarningIcon,
  SuccessIcon,
  CloseIcon,
  CheckIcon,
  CopyIcon,
  RotateCcwIcon,
} from '@yellowshifts/icons';
import { WeeklyScheduleGrid } from './WeeklyScheduleGrid';
import { QuickStaffAssignmentDrawer } from './QuickStaffAssignmentDrawer';
import { DuplicateShiftModal } from './DuplicateShiftModal';
import { CopyPreviousWeekModal } from './CopyPreviousWeekModal';
import { PublishValidationModal } from './PublishValidationModal';
import { EditShiftModal } from './EditShiftModal';
import { AddShiftModal } from './AddShiftModal';

interface WeeklyScheduleManagerProps {
  stationId: string;
  stationName: string;
  currentWeekStart: string;
  selectedWeekStart: string; // YYYY-MM-DD (Sunday)
  schedule: WeeklyScheduleDetails | null;
  templates: ShiftTemplate[];
  activeMembers: StationMemberWithProfile[];
  availabilityRecords?: Record<string, WeeklyAvailabilityWithEntries>;
  canEdit: boolean;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.slice(0, 10).split('-');
  const y = parts[0] ?? '';
  const m = parts[1] ?? '';
  const d = parts[2] ?? '';
  return `${d}/${m}/${y}`;
}

export function WeeklyScheduleManager({
  stationId,
  stationName: _stationName,
  selectedWeekStart,
  currentWeekStart,
  schedule,
  templates,
  activeMembers,
  availabilityRecords,
  canEdit,
}: WeeklyScheduleManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Global feedback notification
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Optimistic schedule state
  const [localSchedule, setLocalSchedule] = useState<WeeklyScheduleDetails | null>(schedule);
  useEffect(() => {
    setLocalSchedule(schedule);
  }, [schedule]);

  // Modal & Drawer states
  const [addShiftDate, setAddShiftDate] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<ScheduledShiftWithDetails | null>(null);
  const [duplicatingShift, setDuplicatingShift] = useState<ScheduledShiftWithDetails | null>(null);
  const [activeShiftIdForDrawer, setActiveShiftIdForDrawer] = useState<string | null>(null);
  const [showCopyWeekModal, setShowCopyWeekModal] = useState(false);
  const [showPublishValidationModal, setShowPublishValidationModal] = useState(false);

  // Optimistic assignment handlers
  const handleOptimisticAssign = (
    shiftId: string,
    member: StationMemberWithProfile,
    tempAssignmentId: string
  ) => {
    setLocalSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shifts: prev.shifts.map((s) => {
          if (s.id !== shiftId) return s;
          const newAssignment: ShiftAssignmentWithProfile = {
            id: tempAssignmentId,
            scheduledShiftId: shiftId,
            stationId,
            stationMembershipId: member.membership.id,
            status: 'ASSIGNED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            membership: {
              id: member.membership.id,
              role: member.membership.role,
              status: member.membership.status,
              employeeCode: member.membership.employeeCode,
            },
            user: {
              id: member.profile.id,
              fullName: member.profile.fullName,
              email: member.profile.email ?? null,
              phone: member.profile.phone ?? null,
              avatarUrl: member.profile.avatarUrl ?? null,
            },
          };
          return {
            ...s,
            assignments: [...s.assignments, newAssignment],
          };
        }),
      };
    });
  };

  const handleReconcileAssign = (
    shiftId: string,
    tempAssignmentId: string,
    realAssignment: ShiftAssignmentWithProfile
  ) => {
    setLocalSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shifts: prev.shifts.map((s) => {
          if (s.id !== shiftId) return s;
          return {
            ...s,
            assignments: s.assignments.map((a) => (a.id === tempAssignmentId ? realAssignment : a)),
          };
        }),
      };
    });
  };

  const handleRollbackAssign = (shiftId: string, tempAssignmentId: string) => {
    setLocalSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shifts: prev.shifts.map((s) => {
          if (s.id !== shiftId) return s;
          return {
            ...s,
            assignments: s.assignments.filter((a) => a.id !== tempAssignmentId),
          };
        }),
      };
    });
  };

  const handleOptimisticRemove = (shiftId: string, assignmentId: string) => {
    setLocalSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shifts: prev.shifts.map((s) => {
          if (s.id !== shiftId) return s;
          return {
            ...s,
            assignments: s.assignments.filter((a) => a.id !== assignmentId),
          };
        }),
      };
    });
  };

  const handleRollbackRemove = (
    shiftId: string,
    removedAssignment: ShiftAssignmentWithProfile
  ) => {
    setLocalSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shifts: prev.shifts.map((s) => {
          if (s.id !== shiftId) return s;
          return {
            ...s,
            assignments: [...s.assignments, removedAssignment],
          };
        }),
      };
    });
  };

  // Derive the active shift for drawer from the latest optimistic schedule data
  const drawerShift = activeShiftIdForDrawer
    ? (localSchedule?.shifts.find((s) => s.id === activeShiftIdForDrawer) ?? null)
    : null;

  const currentSunday = currentWeekStart;
  const isViewingCurrentWeek = selectedWeekStart === currentSunday;
  const weekEnd = addDays(selectedWeekStart, 6);

  const navigateWeek = (offsetDays: number) => {
    const nextWeek = addDays(selectedWeekStart, offsetDays);
    router.push(`?week=${nextWeek}`);
  };

  const jumpToCurrentWeek = () => {
    router.push(`?week=${currentSunday}`);
  };

  const handleCreateSchedule = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('stationId', stationId);
      formData.append('weekStartDate', selectedWeekStart);

      const res = await createWeeklyScheduleAction(null, formData);
      if (res.success) {
        setFeedback({ type: 'success', text: 'סידור עבודה שבועי בסטטוס טיוטה הוקם בהצלחה' });
        router.refresh();
      } else {
        setFeedback({ type: 'error', text: res.error || 'שגיאה ביצירת סידור שבועי' });
      }
    });
  };

  const handleRevertToDraft = () => {
    if (!schedule) return;
    startTransition(async () => {
      const res = await revertScheduleToDraftAction(stationId, schedule.id);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: 'הסידור הוחזר לסטטוס טיוטה (DRAFT) ופתוח כעת לעריכה מחדש',
        });
        router.refresh();
      } else {
        setFeedback({ type: 'error', text: res.error || 'שגיאה בהחזרת סידור לטיוטה' });
      }
    });
  };

  const handleDeleteShift = (shiftId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק משמרת זו מהסידור?')) return;

    startTransition(async () => {
      const res = await deleteScheduledShiftAction(stationId, shiftId);
      if (res.success) {
        setFeedback({ type: 'success', text: 'המשמרת נמחקה מהסידור בהצלחה' });
        if (activeShiftIdForDrawer === shiftId) {
          setActiveShiftIdForDrawer(null);
        }
        router.refresh();
      } else {
        setFeedback({ type: 'error', text: res.error || 'שגיאה במחיקת משמרת' });
      }
    });
  };

  const handleCopyWeekSuccess = (result: CopyWeekResult) => {
    setShowCopyWeekModal(false);
    let msg = `הועתקו בהצלחה ${result.copiedShifts} משמרות משבוע קודם.`;
    if (result.copiedAssignments > 0) {
      msg += ` שובצו ${result.copiedAssignments} עובדים פעילים.`;
    }
    if (result.skippedInactiveWorkers > 0) {
      msg += ` דולגו ${result.skippedInactiveWorkers} שיבוצים של עובדים שאינם פעילים בתחנה.`;
    }
    setFeedback({ type: 'success', text: msg });
    router.refresh();
  };

  const handlePublishSuccess = () => {
    setShowPublishValidationModal(false);
    setFeedback({
      type: 'success',
      text: 'סידור העבודה פורסם רשמית וגלוי כעת לכלל עובדי התחנה',
    });
    router.refresh();
  };

  return (
    <div
      className="schedule-manager"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Week Navigator & Status / Actions Bar */}
      <Card
        className="schedule-toolbar"
        style={{
          padding: 0,
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <CardContent style={{ padding: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <nav className="admin-week-nav" aria-label="בחירת שבוע">
              <div className="admin-week-date">
                <small>השבוע הנבחר</small>
                <strong dir="ltr">
                  {formatDateDisplay(selectedWeekStart)} – {formatDateDisplay(weekEnd)}
                </strong>
              </div>
              <button
                type="button"
                className="admin-week-previous"
                onClick={() => navigateWeek(-7)}
                disabled={isPending}
              >
                <ChevronRightIcon size={18} />
                <span>שבוע קודם</span>
              </button>
              <button
                type="button"
                className="admin-week-next"
                onClick={() => navigateWeek(7)}
                disabled={isPending}
              >
                <span>שבוע הבא</span>
                <ChevronLeftIcon size={18} />
              </button>
              {!isViewingCurrentWeek && (
                <button
                  type="button"
                  className="admin-week-today"
                  onClick={jumpToCurrentWeek}
                  disabled={isPending}
                >
                  השבוע הנוכחי
                </button>
              )}
            </nav>

            {/* Schedule Status & Primary Actions */}
            <div className="schedule-status-actions">
              {schedule ? (
                <>
                  <div className="schedule-action-group">
                    <span style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>סטטוס:</span>
                    {schedule.status === 'DRAFT' && (
                      <Badge variant="warning">טיוטה (ניתן לעריכה)</Badge>
                    )}
                    {schedule.status === 'PUBLISHED' && (
                      <Badge
                        variant="success"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CheckIcon size={12} />
                        <span>פורסם (רשמי)</span>
                      </Badge>
                    )}
                    {schedule.status === 'ARCHIVED' && (
                      <Badge variant="neutral">בארכיון (היסטורי)</Badge>
                    )}
                  </div>

                  {canEdit && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {schedule.status === 'DRAFT' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowCopyWeekModal(true)}
                            disabled={isPending}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            title="העתק משמרות משבוע קודם"
                          >
                            <CopyIcon size={15} />
                            <span>העתק משבוע קודם</span>
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setShowPublishValidationModal(true)}
                            disabled={isPending}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <SendIcon size={15} />
                            <span>פרסם סידור עבודה</span>
                          </Button>
                        </>
                      )}

                      {schedule.status === 'PUBLISHED' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="btn-revert-draft"
                          onClick={handleRevertToDraft}
                          disabled={isPending}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            backgroundColor: '#FFFBEB',
                            borderColor: '#D97706',
                            color: '#92400E',
                            fontWeight: 600,
                          }}
                          title="החזר את הסידור למצב טיוטה כדי לערוך משמרות ושיבוצים"
                        >
                          <RotateCcwIcon size={14} style={{ color: '#D97706', flexShrink: 0 }} />
                          <span>החזר סידור לטיוטה לצורך עריכה</span>
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Badge variant="neutral">טרם הוקם סידור</Badge>
                  {canEdit && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowCopyWeekModal(true)}
                        disabled={isPending}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <CopyIcon size={15} />
                        <span>העתק משבוע קודם</span>
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleCreateSchedule}
                        disabled={isPending}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <PlusIcon size={16} />
                        <span>צור סידור שבועי חדש</span>
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '8px',
            backgroundColor: feedback.type === 'success' ? '#064E3B' : '#7F1D1D',
            color: '#FFFFFF',
            fontSize: '0.875rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedback.type === 'success' ? <SuccessIcon size={20} /> : <WarningIcon size={20} />}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>
      )}

      {/* Main Weekly Content Area */}
      {!schedule ? (
        <Card
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <CardContent style={{ textAlign: 'center', padding: '72px 24px' }}>
            <CalendarIcon size={60} style={{ color: '#9CA3AF', margin: '0 auto 18px' }} />
            <h3
              style={{
                fontSize: '1.375rem',
                fontWeight: 700,
                color: '#111827',
                marginBottom: '10px',
              }}
            >
              אין סידור עבודה מוקם עבור שבוע זה
            </h3>
            <p
              style={{
                fontSize: '0.9375rem',
                color: '#6B7280',
                maxWidth: '480px',
                margin: '0 auto 28px',
                lineHeight: '1.6',
              }}
            >
              שבוע מ-<strong>{formatDateDisplay(selectedWeekStart)}</strong> עד{' '}
              <strong>{formatDateDisplay(weekEnd)}</strong>. ניתן ליצור סידור טיוטה ריק חדש, או
              להעתיק ישירות את מבנה המשמרות והעובדים מהשבוע שקדם לו.
            </p>
            {canEdit && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => setShowCopyWeekModal(true)}
                  disabled={isPending}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <CopyIcon size={18} />
                  <span>העתק משבוע קודם</span>
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateSchedule}
                  disabled={isPending}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <PlusIcon size={18} />
                  <span>צור סידור עבודה ריק</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Weekly Grid Component */
        <WeeklyScheduleGrid
          stationId={stationId}
          weekStartDate={selectedWeekStart}
          shifts={localSchedule?.shifts ?? schedule.shifts}
          templates={templates}
          activeMembers={activeMembers}
          canEdit={canEdit}
          isDraft={localSchedule?.status === 'DRAFT'}
          onOpenAddShift={(dateStr: string) => setAddShiftDate(dateStr)}
          onOpenQuickAssign={(shift: ScheduledShiftWithDetails) =>
            setActiveShiftIdForDrawer(shift.id)
          }
          onOpenDuplicateShift={(shift: ScheduledShiftWithDetails) => setDuplicatingShift(shift)}
          onOpenEditShift={(shift: ScheduledShiftWithDetails) => setEditingShift(shift)}
          onDeleteShift={handleDeleteShift}
        />
      )}

      {/* Quick Staff Assignment Drawer */}
      {drawerShift && (
        <QuickStaffAssignmentDrawer
          stationId={stationId}
          shift={drawerShift}
          activeMembers={activeMembers}
          availabilityRecords={availabilityRecords}
          canEdit={canEdit}
          isDraft={localSchedule?.status === 'DRAFT'}
          onClose={() => setActiveShiftIdForDrawer(null)}
          onOptimisticAssign={handleOptimisticAssign}
          onReconcileAssign={handleReconcileAssign}
          onRollbackAssign={handleRollbackAssign}
          onOptimisticRemove={handleOptimisticRemove}
          onRollbackRemove={handleRollbackRemove}
        />
      )}

      {/* Add Shift Modal */}
      {schedule && (
        <AddShiftModal
          isOpen={!!addShiftDate}
          onClose={() => setAddShiftDate(null)}
          stationId={stationId}
          scheduleId={schedule.id}
          shiftDate={addShiftDate}
          templates={templates}
          onSuccess={(msg) => {
            setFeedback({ type: 'success', text: msg });
            router.refresh();
          }}
        />
      )}

      {/* Edit Shift Modal */}
      {editingShift && (
        <EditShiftModal
          stationId={stationId}
          shift={editingShift}
          onClose={() => setEditingShift(null)}
          onSuccess={() => {
            setFeedback({ type: 'success', text: 'שעות המשמרת עודכנו בהצלחה' });
            setEditingShift(null);
            router.refresh();
          }}
        />
      )}

      {/* Duplicate Shift Modal */}
      {duplicatingShift && schedule && (
        <DuplicateShiftModal
          stationId={stationId}
          scheduleId={schedule.id}
          shift={duplicatingShift}
          weekStartDate={selectedWeekStart}
          onClose={() => setDuplicatingShift(null)}
          onSuccess={() => {
            setFeedback({ type: 'success', text: 'המשמרת שוכפלה בהצלחה' });
            setDuplicatingShift(null);
            router.refresh();
          }}
        />
      )}

      {/* Copy Previous Week Modal */}
      {showCopyWeekModal && (
        <CopyPreviousWeekModal
          stationId={stationId}
          targetWeekStartDate={selectedWeekStart}
          onClose={() => setShowCopyWeekModal(false)}
          onSuccess={handleCopyWeekSuccess}
        />
      )}

      {/* Pre-publish Validation & Publish Confirmation Modal */}
      {showPublishValidationModal && schedule && (
        <PublishValidationModal
          stationId={stationId}
          scheduleId={schedule.id}
          weekStartDate={selectedWeekStart}
          onClose={() => setShowPublishValidationModal(false)}
          onSuccess={handlePublishSuccess}
        />
      )}
    </div>
  );
}
