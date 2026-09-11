/**
 * Multi-Station Domain Types for YellowShifts.
 */

import type { StationMembership, UserProfile, StationRole, MembershipStatus } from './auth';

export interface Station {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly timezone: string;
  readonly isActive: boolean;
  readonly nfcPublicToken?: string;
  readonly allowedLateMinutes: number;
  readonly allowedEarlyLeaveMinutes: number;
  readonly leftOpenWarningHours: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateStationInput {
  readonly code: string;
  readonly name: string;
  readonly address?: string | null;
  readonly phone?: string | null;
  readonly timezone?: string;
  readonly isActive?: boolean;
}

export interface UpdateStationInput {
  readonly name?: string;
  readonly address?: string | null;
  readonly phone?: string | null;
  readonly timezone?: string;
  readonly isActive?: boolean;
  readonly allowedLateMinutes?: number;
  readonly allowedEarlyLeaveMinutes?: number;
  readonly leftOpenWarningHours?: number;
}

export interface StationMemberWithProfile {
  readonly membership: StationMembership;
  readonly profile: UserProfile;
}

export interface AssignStationMemberInput {
  readonly stationId: string;
  readonly userId?: string;
  readonly email?: string;
  readonly role: StationRole;
  readonly employeeCode?: string | null;
}

export interface UpdateMemberRoleInput {
  readonly stationId: string;
  readonly membershipId: string;
  readonly role: StationRole;
}

export interface UpdateMemberStatusInput {
  readonly stationId: string;
  readonly membershipId: string;
  readonly status: MembershipStatus;
}

export interface StaffFilters {
  readonly search?: string;
  readonly role?: StationRole | 'ALL';
  readonly status?: MembershipStatus | 'ALL';
}
