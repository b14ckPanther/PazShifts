import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  AuthenticatedUserContext,
  StationWithMembership,
  Station,
  StationMembership,
  UserProfile,
} from '@yellowshifts/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TypedSupabaseClient = SupabaseClient<Database, any>;

/**
 * Resolves the complete authenticated user context including profile,
 * global Platform Admin status, and active station memberships.
 *
 * All authorization is verified against real database tables and RLS.
 */
export async function getAuthenticatedUserContext(
  supabase: TypedSupabaseClient
): Promise<AuthenticatedUserContext | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // 1. Fetch Profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const profile: UserProfile | null = profileData
    ? {
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name,
        phone: profileData.phone,
        preferredLocale: profileData.preferred_locale,
        avatarUrl: profileData.avatar_url,
        isActive: profileData.is_active,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at,
      }
    : null;

  // 2. Check Platform Admin status
  const { data: platformAdminData } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  const isPlatformAdmin = Boolean(platformAdminData);

  // 3. Fetch Station Memberships with Joined Station Data
  const { data: membershipsData } = await supabase
    .from('station_memberships')
    .select('*, stations(*)')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE');

  const memberships: StationWithMembership[] = [];

  if (membershipsData && Array.isArray(membershipsData)) {
    for (const item of membershipsData) {
      // Supabase join typing: stations is the joined table row
      const rawStation = (
        item as unknown as { stations: Database['public']['Tables']['stations']['Row'] | null }
      ).stations;
      if (rawStation && rawStation.is_active) {
        const station: Station = {
          id: rawStation.id,
          code: rawStation.code,
          name: rawStation.name,
          address: rawStation.address,
          phone: rawStation.phone,
          timezone: rawStation.timezone,
          isActive: rawStation.is_active,
          allowedLateMinutes: rawStation.allowed_late_minutes,
          allowedEarlyLeaveMinutes: rawStation.allowed_early_leave_minutes,
          leftOpenWarningHours: rawStation.left_open_warning_hours,
          createdAt: rawStation.created_at,
          updatedAt: rawStation.updated_at,
        };

        const membership: StationMembership = {
          id: item.id,
          stationId: item.station_id,
          userId: item.user_id,
          role: item.role,
          status: item.status,
          employeeCode: item.employee_code,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };

        memberships.push({
          station,
          membership,
        });
      }
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    profile,
    isPlatformAdmin,
    memberships,
  };
}

/**
 * Server-side verification for requested station access.
 * Returns the matched membership or verifies platform admin override.
 * Never trusts a client-supplied station ID without this check.
 */
export async function verifyStationAccess(
  supabase: TypedSupabaseClient,
  stationId: string
): Promise<{ hasAccess: boolean; isPlatformAdmin: boolean; role?: StationMembership['role'] }> {
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    return { hasAccess: false, isPlatformAdmin: false };
  }

  if (context.isPlatformAdmin) {
    return { hasAccess: true, isPlatformAdmin: true };
  }

  const userMembership = context.memberships.find(
    (item) => item.station.id === stationId && item.membership.status === 'ACTIVE'
  );

  if (userMembership) {
    return {
      hasAccess: true,
      isPlatformAdmin: false,
      role: userMembership.membership.role,
    };
  }

  return { hasAccess: false, isPlatformAdmin: false };
}
