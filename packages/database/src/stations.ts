import type {
  Station,
  CreateStationInput,
  UpdateStationInput,
  StationMembership,
  StationMemberWithProfile,
  AssignStationMemberInput,
  UpdateMemberRoleInput,
  UpdateMemberStatusInput,
  UserProfile,
  Database,
} from '@yellowshifts/types';
import type { TypedSupabaseClient } from './auth';

function mapStationRow(row: Database['public']['Tables']['stations']['Row']): Station {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    address: row.address,
    phone: row.phone,
    timezone: row.timezone,
    isActive: row.is_active,
    nfcPublicToken: row.nfc_public_token,
    allowedLateMinutes: row.allowed_late_minutes,
    allowedEarlyLeaveMinutes: row.allowed_early_leave_minutes,
    leftOpenWarningHours: row.left_open_warning_hours,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfileRow(row: Database['public']['Tables']['profiles']['Row']): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    preferredLocale: row.preferred_locale,
    avatarUrl: row.avatar_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lists all stations accessible to the caller.
 * Platform Admin sees all stations; Station Admin sees assigned stations via RLS.
 */
export async function listAllStations(supabase: TypedSupabaseClient): Promise<Station[]> {
  const { data, error } = await supabase
    .from('stations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`שגיאה בטעינת תחנות: ${error.message}`);
  }

  return (data ?? []).map(mapStationRow);
}

/**
 * Retrieves a single station by its unique ID.
 */
export async function getStationById(
  supabase: TypedSupabaseClient,
  stationId: string
): Promise<Station | null> {
  const { data, error } = await supabase
    .from('stations')
    .select('*')
    .eq('id', stationId)
    .maybeSingle();

  if (error) {
    throw new Error(`שגיאה בטעינת תחנה: ${error.message}`);
  }

  return data ? mapStationRow(data) : null;
}

/**
 * Creates a new station in the system.
 * Only Platform Admin has RLS / database authority to create stations.
 */
export async function createStation(
  supabase: TypedSupabaseClient,
  input: CreateStationInput
): Promise<Station> {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();

  if (!code || !name) {
    throw new Error('קוד תחנה ושם תחנה הינם שדות חובה.');
  }

  const { data, error } = await supabase
    .from('stations')
    .insert({
      code,
      name,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      timezone: input.timezone || 'Asia/Jerusalem',
      is_active: input.isActive ?? true,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`קוד התחנה "${code}" כבר קיים במערכת. יש לבחור קוד ייחודי.`);
    }
    throw new Error(`שגיאה ביצירת תחנה: ${error.message}`);
  }

  return mapStationRow(data);
}

/**
 * Updates an existing station's details.
 */
export async function updateStation(
  supabase: TypedSupabaseClient,
  stationId: string,
  input: UpdateStationInput
): Promise<Station> {
  const updatePayload: Database['public']['Tables']['stations']['Update'] = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updatePayload.name = input.name.trim();
  if (input.address !== undefined) updatePayload.address = input.address?.trim() || null;
  if (input.phone !== undefined) updatePayload.phone = input.phone?.trim() || null;
  if (input.timezone !== undefined) updatePayload.timezone = input.timezone;
  if (input.isActive !== undefined) updatePayload.is_active = input.isActive;
  if (input.allowedLateMinutes !== undefined)
    updatePayload.allowed_late_minutes = input.allowedLateMinutes;
  if (input.allowedEarlyLeaveMinutes !== undefined)
    updatePayload.allowed_early_leave_minutes = input.allowedEarlyLeaveMinutes;
  if (input.leftOpenWarningHours !== undefined)
    updatePayload.left_open_warning_hours = input.leftOpenWarningHours;

  const { data, error } = await supabase
    .from('stations')
    .update(updatePayload)
    .eq('id', stationId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`שגיאה בעדכון תחנה: ${error.message}`);
  }

  return mapStationRow(data);
}

/**
 * Toggles a station's active status (activate / deactivate).
 */
export async function toggleStationStatus(
  supabase: TypedSupabaseClient,
  stationId: string,
  isActive: boolean
): Promise<Station> {
  return updateStation(supabase, stationId, { isActive });
}

/**
 * Retrieves all memberships for a given station including joined user profiles.
 */
export async function getStationMembers(
  supabase: TypedSupabaseClient,
  stationId: string
): Promise<StationMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('station_memberships')
    .select('*, profiles(*)')
    .eq('station_id', stationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`שגיאה בטעינת אנשי צוות התחנה: ${error.message}`);
  }

  const result: StationMemberWithProfile[] = [];

  for (const item of data ?? []) {
    const rawProfile = (
      item as unknown as { profiles: Database['public']['Tables']['profiles']['Row'] | null }
    ).profiles;

    if (rawProfile) {
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

      result.push({
        membership,
        profile: mapProfileRow(rawProfile),
      });
    }
  }

  return result;
}

/**
 * Assigns an existing authenticated user to a station.
 * Supports roles: ADMIN, SHIFT_MANAGER, WORKER.
 * If user does not exist in Supabase, rejects operation cleanly.
 */
export async function assignStationMember(
  supabase: TypedSupabaseClient,
  input: AssignStationMemberInput
): Promise<StationMembership> {
  let targetUserId = input.userId;

  // If email was supplied, look up the profile ID
  if (!targetUserId && input.email) {
    const trimmedEmail = input.email.trim().toLowerCase();
    const { data: matchedProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`שגיאה בחיפוש משתמש: ${profileErr.message}`);
    }

    if (!matchedProfile) {
      throw new Error(`לא נמצא משתמש במערכת עם כתובת האימייל "${trimmedEmail}".`);
    }

    targetUserId = matchedProfile.id;
  }

  if (!targetUserId) {
    throw new Error('יש לבחור משתמש תקין להקצאה.');
  }

  const { data, error } = await supabase
    .from('station_memberships')
    .insert({
      station_id: input.stationId,
      user_id: targetUserId,
      role: input.role,
      status: 'ACTIVE',
      employee_code: input.employeeCode?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`שגיאה בהקצאת משתמש לתחנה: ${error.message}`);
  }

  return {
    id: data.id,
    stationId: data.station_id,
    userId: data.user_id,
    role: data.role,
    status: data.status,
    employeeCode: data.employee_code,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Removes a member's access from a station.
 */
export async function removeStationMember(
  supabase: TypedSupabaseClient,
  membershipId: string,
  stationId: string
): Promise<void> {
  // Preserve the membership referenced by attendance and historical schedules.
  await updateStationMemberStatus(supabase, { stationId, membershipId, status: 'INACTIVE' });
}

/**
 * Lists all registered active users in the system that can be assigned to stations.
 * Platform Admin has full visibility into profiles under RLS.
 */
export async function listAssignableUsers(supabase: TypedSupabaseClient): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(`שגיאה בטעינת רשימת משתמשים: ${error.message}`);
  }

  return (data ?? []).map(mapProfileRow);
}

/**
 * Counts how many active ADMIN members exist for a station.
 * Optionally excludes a membership ID (to check remaining count during demotion/removal).
 */
export async function countActiveStationAdmins(
  supabase: TypedSupabaseClient,
  stationId: string,
  excludeMembershipId?: string
): Promise<number> {
  let query = supabase
    .from('station_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('station_id', stationId)
    .eq('role', 'ADMIN')
    .eq('status', 'ACTIVE');

  if (excludeMembershipId) {
    query = query.neq('id', excludeMembershipId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`שגיאה בבדיקת מנהלי תחנה פעילים: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Retrieves a single station member by userId with profile.
 */
export async function getStationMemberByUserId(
  supabase: TypedSupabaseClient,
  stationId: string,
  userId: string
): Promise<StationMemberWithProfile | null> {
  const { data, error } = await supabase
    .from('station_memberships')
    .select('*, profiles(*)')
    .eq('station_id', stationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`שגיאה בטעינת פרטי איש צוות: ${error.message}`);
  }

  if (!data) return null;

  const rawProfile = (
    data as unknown as { profiles: Database['public']['Tables']['profiles']['Row'] | null }
  ).profiles;

  if (!rawProfile) return null;

  return {
    membership: {
      id: data.id,
      stationId: data.station_id,
      userId: data.user_id,
      role: data.role,
      status: data.status,
      employeeCode: data.employee_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    profile: mapProfileRow(rawProfile),
  };
}

/**
 * Retrieves a single station member by membership ID with profile.
 */
export async function getStationMemberById(
  supabase: TypedSupabaseClient,
  stationId: string,
  membershipId: string
): Promise<StationMemberWithProfile | null> {
  const { data, error } = await supabase
    .from('station_memberships')
    .select('*, profiles(*)')
    .eq('station_id', stationId)
    .eq('id', membershipId)
    .maybeSingle();

  if (error) {
    throw new Error(`שגיאה בטעינת פרטי חברות בתחנה: ${error.message}`);
  }

  if (!data) return null;

  const rawProfile = (
    data as unknown as { profiles: Database['public']['Tables']['profiles']['Row'] | null }
  ).profiles;

  if (!rawProfile) return null;

  return {
    membership: {
      id: data.id,
      stationId: data.station_id,
      userId: data.user_id,
      role: data.role,
      status: data.status,
      employeeCode: data.employee_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    profile: mapProfileRow(rawProfile),
  };
}

/**
 * Updates a member's station role.
 */
export async function updateStationMemberRole(
  supabase: TypedSupabaseClient,
  input: UpdateMemberRoleInput
): Promise<StationMembership> {
  const { data, error } = await supabase
    .from('station_memberships')
    .update({
      role: input.role,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.membershipId)
    .eq('station_id', input.stationId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`שגיאה בעדכון תפקיד עובד: ${error.message}`);
  }

  return {
    id: data.id,
    stationId: data.station_id,
    userId: data.user_id,
    role: data.role,
    status: data.status,
    employeeCode: data.employee_code,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Updates a member's station status (ACTIVE, INACTIVE, SUSPENDED).
 */
export async function updateStationMemberStatus(
  supabase: TypedSupabaseClient,
  input: UpdateMemberStatusInput
): Promise<StationMembership> {
  const { data, error } = await supabase
    .from('station_memberships')
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.membershipId)
    .eq('station_id', input.stationId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`שגיאה בעדכון סטטוס עובד: ${error.message}`);
  }

  return {
    id: data.id,
    stationId: data.station_id,
    userId: data.user_id,
    role: data.role,
    status: data.status,
    employeeCode: data.employee_code,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
