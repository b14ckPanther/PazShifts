export type AttendanceStatus = 'ACTIVE' | 'COMPLETED' | 'FLAGGED';
export type AttendanceSource = 'NFC' | 'MANUAL_ADMIN';

export interface AttendanceRecord {
  id: string;
  station_id: string;
  station_membership_id: string;
  user_id: string;
  scheduled_shift_id: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  status: AttendanceStatus;
  clock_in_source: AttendanceSource;
  clock_out_source: AttendanceSource | null;
  corrected_by: string | null;
  correction_reason: string | null;
  corrected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecordWithDetails extends AttendanceRecord {
  station?: {
    id: string;
    code: string;
    name: string;
    timezone: string;
  };
  user?: {
    id: string;
    full_name: string;
    phone: string | null;
  };
  membership?: {
    id: string;
    role: string;
    employee_code: string | null;
  };
  scheduled_shift?: {
    id: string;
    shift_date: string;
    start_at: string;
    end_at: string;
    notes: string | null;
    shift_template?: {
      name: string;
      start_time: string;
      end_time: string;
    } | null;
  } | null;
  corrector?: {
    id: string;
    full_name: string;
  } | null;
}

export interface ResolvedNfcStation {
  id: string;
  code: string;
  name: string;
  address: string | null;
  timezone: string;
  is_active: boolean;
}

export interface ClockInInput {
  stationId: string;
  membershipId: string;
  userId: string;
}

export interface ClockInResult {
  success: boolean;
  attendanceRecord?: AttendanceRecord;
  error?: string;
  conflict?: {
    isOtherStation: boolean;
    stationName?: string;
  };
  linkedScheduledShiftId?: string | null;
}

export interface ClockOutInput {
  attendanceRecordId: string;
  userId: string;
}

export interface ClockOutResult {
  success: boolean;
  attendanceRecord?: AttendanceRecord;
  durationMinutes?: number;
  error?: string;
}

export interface AdminAttendanceCorrectionInput {
  attendanceRecordId: string;
  stationId: string;
  adminUserId: string;
  action: 'CLOSE' | 'FLAG';
  reason: string;
  clockOutAt?: string;
}

// --- Phase 9: Attendance Exceptions ---

export type AttendanceDeviation =
  | 'ON_TIME'
  | 'LATE'
  | 'EARLY_LEAVE'
  | 'LATE_AND_EARLY_LEAVE'
  | 'NO_SHOW'
  | 'UNSCHEDULED'
  | 'LEFT_OPEN';

export interface StationTolerances {
  allowedLateMinutes: number;
  allowedEarlyLeaveMinutes: number;
  leftOpenWarningHours: number;
}

export interface AttendanceException {
  id: string;
  deviation: AttendanceDeviation;
  attendanceRecord: AttendanceRecordWithDetails | null;
  scheduledShift: {
    id: string;
    shiftDate: string;
    startAt: string;
    endAt: string;
    templateName: string | null;
  } | null;
  worker: {
    id: string;
    fullName: string;
    phone: string | null;
    employeeCode: string | null;
    membershipId: string;
  };
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualClockIn: string | null;
  actualClockOut: string | null;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
  openHours: number | null;
}

export interface StationExceptionsResult {
  exceptions: AttendanceException[];
  tolerances: StationTolerances;
  date: string;
  totalScheduledShifts: number;
  totalAttendanceRecords: number;
}

export type NfcScanResult =
  | {
      success: true;
      action: 'CLOCK_IN' | 'CLOCK_OUT' | 'CHECKOUT_PENDING' | 'CANCELLED';
      record: AttendanceRecord;
      replayed: boolean;
      duplicate?: boolean;
    }
  | { success: false; code: string; error?: string };
