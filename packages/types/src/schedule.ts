import type { StationRole, MembershipStatus } from './auth';

export type ScheduleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ShiftAssignmentStatus = 'ASSIGNED' | 'CONFIRMED' | 'DECLINED';

export interface ShiftTemplate {
  id: string;
  stationId: string;
  name: string;
  startTime: string; // "HH:MM:SS" or "HH:MM"
  endTime: string; // "HH:MM:SS" or "HH:MM"
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  stationId: string;
  weekStartDate: string; // "YYYY-MM-DD", Monday
  status: ScheduleStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledShift {
  id: string;
  scheduleId: string;
  stationId: string;
  shiftTemplateId: string | null;
  shiftDate: string; // "YYYY-MM-DD"
  startAt: string; // ISO timestamp
  endAt: string; // ISO timestamp
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftAssignment {
  id: string;
  scheduledShiftId: string;
  stationId: string;
  stationMembershipId: string;
  status: ShiftAssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftAssignmentWithProfile extends ShiftAssignment {
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
  };
  membership: {
    id: string;
    role: StationRole;
    status: MembershipStatus;
    employeeCode: string | null;
  };
}

export interface ScheduledShiftWithDetails extends ScheduledShift {
  templateName?: string | null;
  assignments: ShiftAssignmentWithProfile[];
}

export interface WeeklyScheduleDetails extends Schedule {
  shifts: ScheduledShiftWithDetails[];
}

export interface CreateShiftTemplateInput {
  stationId: string;
  name: string;
  startTime: string;
  endTime: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateShiftTemplateInput {
  name?: string;
  startTime?: string;
  endTime?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateScheduleInput {
  stationId: string;
  weekStartDate: string; // Must be Monday "YYYY-MM-DD"
  createdBy?: string | null;
}

export interface CreateScheduledShiftInput {
  scheduleId: string;
  stationId: string;
  shiftTemplateId?: string | null;
  shiftDate: string; // "YYYY-MM-DD"
  startAt: string; // ISO
  endAt: string; // ISO
  notes?: string | null;
}

export interface UpdateScheduledShiftInput {
  startAt?: string;
  endAt?: string;
  notes?: string | null;
}

export interface AssignShiftWorkerInput {
  scheduledShiftId: string;
  stationId: string;
  stationMembershipId: string;
  status?: ShiftAssignmentStatus;
}

export interface DuplicateShiftInput {
  sourceShiftId: string;
  stationId: string;
  scheduleId: string;
  targetShiftDate: string; // "YYYY-MM-DD"
  notes?: string | null;
}

export interface CopyWeekOptions {
  stationId: string;
  sourceWeekStartDate: string; // "YYYY-MM-DD", Monday
  targetWeekStartDate: string; // "YYYY-MM-DD", Monday
  copyAssignments: boolean;
  createdBy?: string | null;
}

export interface CopyWeekResult {
  targetScheduleId: string;
  copiedShifts: number;
  copiedAssignments: number;
  skippedInactiveWorkers: number;
}

export interface ScheduleValidationWarning {
  shiftId?: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  templateName?: string | null;
  type: 'no_workers' | 'no_manager';
  message: string;
}

export interface ScheduleValidationResult {
  canPublish: boolean;
  errors: string[];
  warnings: ScheduleValidationWarning[];
  totalShifts: number;
  totalAssignments: number;
}
