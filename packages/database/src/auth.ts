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

function mapStationFromRow(rawStation: Database['public']['Tables']['stations']['Row']): Station {
  return {
    id: rawStation.id,
    latitude: rawStation.latitude,
    longitude: rawStation.longitude,
    attendanceRadiusM: rawStation.attendance_radius_m,
    code: rawStation.code,
    name: rawStation.name,
    address: rawStation.address,
    phone: rawStation.phone,
    timezone: rawStation.timezone,
    isActive: rawStation.is_active,
    nfcPublicToken: rawStation.nfc_public_token,
    allowedLateMinutes: rawStation.allowed_late_minutes,
    allowedEarlyLeaveMinutes: rawStation.allowed_early_leave_minutes,
    leftOpenWarningHours: rawStation.left_open_warning_hours,
    createdAt: rawStation.created_at,
    updatedAt: rawStation.updated_at,
  };
}

function mapProfileFromRow(p: Database['public']['Tables']['profiles']['Row']): UserProfile {
  return {
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    phone: p.phone,
    preferredLocale: p.preferred_locale,
    avatarUrl: p.avatar_url,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/**
 * Resolves the complete authenticated user context including profile,
 * global Platform Admin status, and active station memberships.
 *
 * Uses single-round-trip authenticated RPC for maximum practical latency,
 * falling back gracefully to granular queries for mock/test environments.
 */
export async function getAuthenticatedUserContext(
  supabase: TypedSupabaseClient
): Promise<AuthenticatedUserContext | null> {
  if (typeof (supabase as any)?.rpc === 'function') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
        'get_authenticated_user_context'
      );

    if (!rpcError && rpcData && rpcData.user_id) {
      const profile: UserProfile | null = rpcData.profile
        ? mapProfileFromRow(rpcData.profile)
        : null;

      const memberships: StationWithMembership[] = [];
      if (Array.isArray(rpcData.memberships)) {
        for (const item of rpcData.memberships) {
          if (item?.stations && item.stations.is_active) {
            memberships.push({
              station: mapStationFromRow(item.stations),
              membership: {
                id: item.id,
                stationId: item.station_id,
                userId: item.user_id,
                role: item.role,
                status: item.status,
                employeeCode: item.employee_code,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
              },
            });
          }
        }
      }

        return {
          user: {
            id: rpcData.user_id,
            email: profile?.email ?? null,
          },
          profile,
          isPlatformAdmin: Boolean(rpcData.is_platform_admin),
          memberships,
        };
      }
    } catch {
      // Fall back to standard individual queries below if RPC is unavailable
    }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // These independent reads share the authenticated client and retain RLS.
  const [{ data: profileData }, { data: platformAdminData }, { data: membershipsData }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('station_memberships')
        .select('*, stations(*)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE'),
    ]);

  const profile: UserProfile | null = profileData ? mapProfileFromRow(profileData) : null;
  const isPlatformAdmin = Boolean(platformAdminData);

  const memberships: StationWithMembership[] = [];

  if (membershipsData && Array.isArray(membershipsData)) {
    for (const item of membershipsData) {
      const rawStation = (
        item as unknown as { stations: Database['public']['Tables']['stations']['Row'] | null }
      ).stations;
      if (rawStation && rawStation.is_active) {
        memberships.push({
          station: mapStationFromRow(rawStation),
          membership: {
            id: item.id,
            stationId: item.station_id,
            userId: item.user_id,
            role: item.role,
            status: item.status,
            employeeCode: item.employee_code,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          },
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
