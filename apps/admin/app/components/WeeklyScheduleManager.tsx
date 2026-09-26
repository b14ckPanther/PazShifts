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
import { Button, Badge, StatusBadge, EmptyState, Dialog } from '@yellowshifts/ui';
import {
  CalendarIcon,
  PlusIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  SendIcon,
  WarningIcon,
  SuccessIcon,
  CloseIcon,
  CopyIcon,
  RotateCcwIcon,
  TrashIcon,
  CircleCheckIcon,
} from '@yellowshifts/icons';
import { WeeklyScheduleGrid, countText, shiftHasManager } from './WeeklyScheduleGrid';
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

function timeOf(value: string): string {
  return value.includes('T') ? (value.split('T')[1]?.slice(0, 5) ?? '') : value.slice(11, 16);
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
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);

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

  const handleRollbackRemove = (shiftId: string, removedAssignment: ShiftAssignmentWithProfile) => {
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

  // Confirmed from the delete dialog (replaces the browser confirm()).
  const handleDeleteShift = (shiftId: string) => {
    startTransition(async () => {
      const res = await deleteScheduledShiftAction(stationId, shiftId);
      setDeletingShiftId(null);
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

  const deletingShift = deletingShiftId
    ? (localSchedule?.shifts.find((s) => s.id === deletingShiftId) ?? null)
    : null;
  const deletingTime = deletingShift
    ? `${timeOf(deletingShift.startAt)}–${timeOf(deletingShift.endAt)}`
    : '';

  const handleCopyWeekSuccess = (result: CopyWeekResult) => {
    setShowCopyWeekModal(false);
    let msg =
      result.copiedShifts === 1
        ? 'הועתקה בהצלחה משמרת אחת משבוע קודם.'
        : `הועתקו בהצלחה ${result.copiedShifts} משמרות משבוע קודם.`;
    if (result.copiedAssignments > 0) {
      msg +=
        result.copiedAssignments === 1
          ? ' שובץ עובד פעיל אחד.'
          : ` שובצו ${result.copiedAssignments} עובדים פעילים.`;
    }
    if (result.skippedInactiveWorkers > 0) {
      msg +=
        result.skippedInactiveWorkers === 1
          ? ' דולג שיבוץ אחד של עובד שאינו פעיל בתחנה.'
          : ` דולגו ${result.skippedInactiveWorkers} שיבוצים של עובדים שאינם פעילים בתחנה.`;
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

  const createActions = canEdit && (
    <>
      <Button
        variant="primary"
        onClick={handleCreateSchedule}
        disabled={isPending}
        rightIcon={<PlusIcon size={18} />}
      >
        צור סידור שבועי חדש
      </Button>
      <Button
        variant="secondary"
        onClick={() => setShowCopyWeekModal(true)}
        disabled={isPending}
        rightIcon={<CopyIcon size={17} />}
      >
        העתק משבוע קודם
      </Button>
    </>
  );

  // One week-level staffing summary instead of a warning on every shift card.
  const weekShifts = localSchedule?.shifts ?? schedule?.shifts ?? [];
  const shiftsWithoutManager = weekShifts.filter((s) => !shiftHasManager(s)).length;

  const hasActions = canEdit && (!schedule || schedule.status !== 'ARCHIVED');

  return (
    <div className="schedule-manager">
      {/* Week header: range and status, week navigation, then the action row */}
      <section className="schedule-week-bar" aria-labelledby="schedule-week-range">
        <div className="schedule-week-top">
          <div className="schedule-week-heading">
            <h2 id="schedule-week-range" className="schedule-week-range">
              <span className="ys-visually-hidden">השבוע הנבחר: </span>
              <bdi dir="ltr">
                {formatDateDisplay(selectedWeekStart)} – {formatDateDisplay(weekEnd)}
              </bdi>
            </h2>
            <div className="schedule-week-status">
              <span>סטטוס:</span>
              {!schedule && <Badge variant="neutral">טרם הוקם סידור</Badge>}
              {schedule?.status === 'DRAFT' && (
                <StatusBadge status="draft" label="טיוטה (ניתן לעריכה)" />
              )}
              {schedule?.status === 'PUBLISHED' && (
                <StatusBadge status="published" label="פורסם (רשמי)" />
              )}
              {schedule?.status === 'ARCHIVED' && (
                <Badge variant="neutral">בארכיון (היסטורי)</Badge>
              )}
            </div>
            {schedule && weekShifts.length > 0 && (
              <p
                className={`schedule-week-staffing${shiftsWithoutManager > 0 ? ' is-attention' : ''}`}
              >
                {shiftsWithoutManager > 0 ? (
                  <WarningIcon size={16} aria-hidden="true" />
                ) : (
                  <CircleCheckIcon size={16} aria-hidden="true" />
                )}
                {shiftsWithoutManager === 0
                  ? 'לכל המשמרות השבוע משובץ מנהל משמרת'
                  : `${countText(shiftsWithoutManager, 'משמרת אחת', 'משמרות')} ללא מנהל משמרת השבוע`}
              </p>
            )}
          </div>

          <nav className="schedule-week-nav" aria-label="בחירת שבוע">
            <Button
              variant="secondary"
              onClick={() => navigateWeek(-7)}
              disabled={isPending}
              rightIcon={<ChevronRightIcon size={18} />}
            >
              שבוע קודם
            </Button>
            {!isViewingCurrentWeek && (
              <Button
                variant="ghost"
                className="schedule-week-today"
                onClick={jumpToCurrentWeek}
                disabled={isPending}
              >
                השבוע הנוכחי
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => navigateWeek(7)}
              disabled={isPending}
              leftIcon={<ChevronLeftIcon size={18} />}
            >
              שבוע הבא
            </Button>
          </nav>
        </div>

        {hasActions && (
          <div className="schedule-actions">
            {!schedule && createActions}
            {schedule?.status === 'DRAFT' && (
              <>
                <Button
                  variant="primary"
                  onClick={() => setShowPublishValidationModal(true)}
                  disabled={isPending}
                  rightIcon={<SendIcon size={17} />}
                >
                  פרסם סידור עבודה
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowCopyWeekModal(true)}
                  disabled={isPending}
                  rightIcon={<CopyIcon size={17} />}
                >
                  העתק משבוע קודם
                </Button>
              </>
            )}
            {schedule?.status === 'PUBLISHED' && (
              <Button
                variant="secondary"
                onClick={handleRevertToDraft}
                disabled={isPending}
                rightIcon={<RotateCcwIcon size={17} />}
              >
                החזר סידור לטיוטה לצורך עריכה
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Result of the last action */}
      {feedback && (
        <div
          className={`admin-feedback admin-feedback--${feedback.type}`}
          role={feedback.type === 'success' ? 'status' : 'alert'}
        >
          {feedback.type === 'success' ? (
            <SuccessIcon size={20} aria-hidden="true" />
          ) : (
            <WarningIcon size={20} aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
          <Button
            variant="ghost"
            iconOnly
            className="schedule-feedback-close"
            aria-label="סגירת ההודעה"
            onClick={() => setFeedback(null)}
          >
            <CloseIcon size={18} />
          </Button>
        </div>
      )}

      {/* Main weekly content */}
      {!schedule ? (
        <EmptyState
          className="schedule-empty"
          icon={<CalendarIcon size={26} />}
          title="אין סידור עבודה מוקם עבור שבוע זה"
          description={
            <>
              שבוע מ-<bdi dir="ltr">{formatDateDisplay(selectedWeekStart)}</bdi> עד{' '}
              <bdi dir="ltr">{formatDateDisplay(weekEnd)}</bdi>. ניתן ליצור סידור טיוטה ריק חדש, או
              להעתיק ישירות את מבנה המשמרות והעובדים מהשבוע שקדם לו.
            </>
          }
        />
      ) : (
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
          onDeleteShift={(shiftId: string) => setDeletingShiftId(shiftId)}
        />
      )}

      {/* Delete shift confirmation */}
      <Dialog
        open={deletingShiftId !== null}
        onClose={() => setDeletingShiftId(null)}
        dismissible={!isPending}
        title="מחיקת משמרת"
        description="האם אתה בטוח שברצונך למחוק משמרת זו מהסידור?"
        footer={
          <>
            <Button
              variant="destructive"
              isLoading={isPending}
              rightIcon={<TrashIcon size={17} />}
              onClick={() => deletingShiftId && handleDeleteShift(deletingShiftId)}
            >
              מחק משמרת
            </Button>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => setDeletingShiftId(null)}
            >
              ביטול
            </Button>
          </>
        }
      >
        {deletingShift && (
          <p className="schedule-dialog-context">
            <strong>{deletingShift.templateName || 'משמרת מותאמת אישית'}</strong>
            <bdi dir="ltr" className="ys-num">
              {formatDateDisplay(deletingShift.shiftDate)} · {deletingTime}
            </bdi>
            {deletingShift.assignments.length > 0 && (
              <span>
                {deletingShift.assignments.length === 1
                  ? 'עובד אחד משובץ'
                  : `${deletingShift.assignments.length} עובדים משובצים`}
              </span>
            )}
          </p>
        )}
      </Dialog>

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
