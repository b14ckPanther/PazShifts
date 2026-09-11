/**
-- ============================================================================
-- YellowShifts Types: availability.ts
-- Description: Domain types for simplified station-scoped worker availability
-- ============================================================================
*/

export type AvailabilityType = 'ALL_DAY_AVAILABLE' | 'ALL_DAY_UNAVAILABLE' | 'TIME_WINDOW';

export type AvailabilityMatchStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'NOT_SUBMITTED';

export interface AvailabilityWeek {
  id: string;
  stationId: string;
  stationMembershipId: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  notes: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface AvailabilityEntry {
  id: string;
  availabilityWeekId: string;
  date: string; // YYYY-MM-DD
  availabilityType: AvailabilityType;
  startTime: string | null; // HH:MM:SS or HH:MM
  endTime: string | null; // HH:MM:SS or HH:MM
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyAvailabilityWithEntries {
  week: AvailabilityWeek;
  entries: AvailabilityEntry[];
}

export interface SaveAvailabilityEntryInput {
  date: string; // YYYY-MM-DD
  availabilityType: AvailabilityType;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

export interface SaveWeeklyAvailabilityInput {
  stationId: string;
  stationMembershipId: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  notes?: string | null;
  entries: SaveAvailabilityEntryInput[];
}

export interface AvailabilityMatchResult {
  status: AvailabilityMatchStatus;
  label: string;
  reason?: string;
  entry?: AvailabilityEntry | null;
}
