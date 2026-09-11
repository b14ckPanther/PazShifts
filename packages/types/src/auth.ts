/**
 * Multi-Station Role Hierarchy & Authentication Types for YellowShifts.
 *
 * Supported station roles:
 * - ADMIN: Station Administrator (scoped to assigned station)
 * - SHIFT_MANAGER: Station Shift Manager
 * - WORKER: Station Employee / Worker
 *
 * Platform Admin:
 * - Independent global account. NOT a station member, no station_id.
 */

import type { Station } from './station';

export type PlatformRole = 'PLATFORM_ADMIN';

export type StationRole = 'ADMIN' | 'SHIFT_MANAGER' | 'WORKER';

export type UserRole = PlatformRole | StationRole;

export type MembershipStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/**
 * Global Platform Administrator entity.
 * Stored in `public.platform_admins`. Strictly decoupled from station_id.
 */
export interface PlatformAdmin {
  readonly userId: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly createdBy: string | null;
  readonly updatedAt: string;
}

/**
 * User Profile stored in `public.profiles`.
 * Linked 1:1 with `auth.users(id)`.
 */
export interface UserProfile {
  readonly id: string;
  readonly email?: string | null;
  readonly fullName: string;
  readonly phone: string | null;
  readonly preferredLocale: string;
  readonly avatarUrl: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Membership connecting a user to a specific station with a scoped role.
 * Stored in `public.station_memberships`.
 */
export interface StationMembership {
  readonly id: string;
  readonly stationId: string;
  readonly userId: string;
  readonly role: StationRole;
  readonly status: MembershipStatus;
  readonly employeeCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Joined station membership with station details for active session context.
 */
export interface StationWithMembership {
  readonly station: Station;
  readonly membership: StationMembership;
}

/**
 * Complete resolved user authorization context.
 */
export interface AuthenticatedUserContext {
  readonly user: {
    readonly id: string;
    readonly email: string | null;
  };
  readonly profile: UserProfile | null;
  readonly isPlatformAdmin: boolean;
  readonly memberships: readonly StationWithMembership[];
}
