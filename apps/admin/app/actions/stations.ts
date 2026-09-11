'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  createServerSupabaseClient,
  getAuthenticatedUserContext,
  createAdminClient,
  createStation,
  updateStation,
  toggleStationStatus,
  assignStationMember,
  removeStationMember,
  updateStationMemberRole,
  updateStationMemberStatus,
  getStationMemberById,
  countActiveStationAdmins,
} from '@yellowshifts/database';
import type { StationRole, MembershipStatus } from '@yellowshifts/types';

export interface StationActionResult {
  success: boolean;
  stationId?: string;
  error?: string;
}

export interface CreateStationActionInput {
  code?: string;
  name?: string;
  address?: string | null;
  phone?: string | null;
  timezone?: string;
  isActive?: boolean;
}

export interface UpdateStationActionInput {
  name?: string;
  address?: string | null;
  phone?: string | null;
  timezone?: string;
  isActive?: boolean;
}

export async function createStationAction(
  arg1?: StationActionResult | null | CreateStationActionInput | FormData,
  arg2?: FormData | CreateStationActionInput
): Promise<StationActionResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context || !context.isPlatformAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: הקמת תחנות מותרת למנהל מערכת ראשי בלבד.',
    };
  }

  // Resolve input whether called as (payload), (null, payload), (formData), or (null, formData)
  let raw: CreateStationActionInput | FormData | undefined;
  if (arg1 && typeof arg1 === 'object' && !('success' in arg1)) {
    raw = arg1 as CreateStationActionInput | FormData;
  } else if (arg2) {
    raw = arg2;
  }

  let code = '';
  let name = '';
  let address: string | null = null;
  let phone: string | null = null;
  let timezone = 'Asia/Jerusalem';
  let isActive = true;

  if (raw instanceof FormData) {
    code = (raw.get('code') as string)?.trim().toUpperCase() || '';
    name = (raw.get('name') as string)?.trim() || '';
    address = (raw.get('address') as string)?.trim() || null;
    phone = (raw.get('phone') as string)?.trim() || null;
    timezone = (raw.get('timezone') as string)?.trim() || 'Asia/Jerusalem';
    const activeVal = raw.get('isActive');
    isActive = activeVal === 'on' || activeVal === 'true';
  } else if (raw && typeof raw === 'object') {
    code = typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : '';
    name = typeof raw.name === 'string' ? raw.name.trim() : '';
    address = typeof raw.address === 'string' && raw.address.trim() ? raw.address.trim() : null;
    phone = typeof raw.phone === 'string' && raw.phone.trim() ? raw.phone.trim() : null;
    timezone =
      typeof raw.timezone === 'string' && raw.timezone.trim()
        ? raw.timezone.trim()
        : 'Asia/Jerusalem';
    isActive = typeof raw.isActive === 'boolean' ? raw.isActive : true;
  }

  if (!code || code.length < 2) {
    return {
      success: false,
      error: 'נא להזין קוד תחנה תקין (לפחות 2 תווים).',
    };
  }

  if (!name || name.length < 2) {
    return {
      success: false,
      error: 'נא להזין שם תחנה תקין (לפחות 2 תווים).',
    };
  }

  try {
    const station = await createStation(supabase, {
      code,
      name,
      address,
      phone,
      timezone,
      isActive,
    });

    revalidatePath('/');
    revalidatePath('/stations');
    return {
      success: true,
      stationId: station.id,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בלתי צפויה ביצירת תחנה.',
    };
  }
}

export async function updateStationAction(
  stationId: string,
  arg1?: StationActionResult | null | UpdateStationActionInput | FormData,
  arg2?: FormData | UpdateStationActionInput
): Promise<StationActionResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context || !context.isPlatformAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: עריכת תחנות מותרת למנהל מערכת ראשי בלבד.',
    };
  }

  let raw: UpdateStationActionInput | FormData | undefined;
  if (arg1 && typeof arg1 === 'object' && !('success' in arg1)) {
    raw = arg1 as UpdateStationActionInput | FormData;
  } else if (arg2) {
    raw = arg2;
  }

  let name = '';
  let address: string | null = null;
  let phone: string | null = null;
  let timezone = 'Asia/Jerusalem';
  let isActive = true;

  if (raw instanceof FormData) {
    name = (raw.get('name') as string)?.trim() || '';
    address = (raw.get('address') as string)?.trim() || null;
    phone = (raw.get('phone') as string)?.trim() || null;
    timezone = (raw.get('timezone') as string)?.trim() || 'Asia/Jerusalem';
    const activeVal = raw.get('isActive');
    isActive = activeVal === 'on' || activeVal === 'true';
  } else if (raw && typeof raw === 'object') {
    name = typeof raw.name === 'string' ? raw.name.trim() : '';
    address = typeof raw.address === 'string' && raw.address.trim() ? raw.address.trim() : null;
    phone = typeof raw.phone === 'string' && raw.phone.trim() ? raw.phone.trim() : null;
    timezone =
      typeof raw.timezone === 'string' && raw.timezone.trim()
        ? raw.timezone.trim()
        : 'Asia/Jerusalem';
    isActive = typeof raw.isActive === 'boolean' ? raw.isActive : true;
  }

  if (!name || name.length < 2) {
    return {
      success: false,
      error: 'נא להזין שם תחנה תקין (לפחות 2 תווים).',
    };
  }

  try {
    await updateStation(supabase, stationId, {
      name,
      address,
      phone,
      timezone,
      isActive,
    });

    revalidatePath('/');
    revalidatePath('/stations');
    revalidatePath(`/stations/${stationId}`);
    revalidatePath(`/stations/${stationId}/edit`);

    return {
      success: true,
      stationId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בלתי צפויה בעדכון תחנה.',
    };
  }
}

export async function toggleStationStatusAction(
  stationId: string,
  currentStatus: boolean
): Promise<StationActionResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context || !context.isPlatformAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: שינוי סטטוס תחנה מותר למנהל מערכת ראשי בלבד.',
    };
  }

  try {
    await toggleStationStatus(supabase, stationId, !currentStatus);

    revalidatePath('/');
    revalidatePath('/stations');
    revalidatePath(`/stations/${stationId}`);

    return {
      success: true,
      stationId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בשינוי סטטוס תחנה.',
    };
  }
}

export interface AssignStationMemberActionInput {
  stationId: string;
  userEmail?: string;
  userId?: string;
  role: StationRole;
  employeeCode?: string | null;
  createNewUser?: boolean;
  fullName?: string;
  password?: string;
}

export async function assignStationMemberAction(
  arg1?: StationActionResult | null | AssignStationMemberActionInput | FormData,
  arg2?: FormData | AssignStationMemberActionInput
): Promise<StationActionResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    return {
      success: false,
      error: 'נדרשת התחברות למערכת.',
    };
  }

  let raw: AssignStationMemberActionInput | FormData | undefined;
  if (arg1 && typeof arg1 === 'object' && !('success' in arg1)) {
    raw = arg1 as AssignStationMemberActionInput | FormData;
  } else if (arg2) {
    raw = arg2;
  }

  let stationId = '';
  let userEmail = '';
  let userId = '';
  let role: StationRole = 'WORKER';
  let employeeCode: string | null = null;
  let createNewUser = false;
  let fullName = '';
  let password = '';

  if (raw instanceof FormData) {
    stationId = (raw.get('stationId') as string)?.trim() || '';
    userEmail = (raw.get('userEmail') as string)?.trim()?.toLowerCase() || '';
    userId = (raw.get('userId') as string)?.trim() || '';
    role = ((raw.get('role') as string)?.trim() as StationRole) || 'WORKER';
    employeeCode = (raw.get('employeeCode') as string)?.trim() || null;
    createNewUser = raw.get('createNewUser') === 'true' || raw.get('createNewUser') === 'on';
    fullName = (raw.get('fullName') as string)?.trim() || '';
    password = (raw.get('password') as string)?.trim() || '';
  } else if (raw && typeof raw === 'object') {
    stationId = typeof raw.stationId === 'string' ? raw.stationId.trim() : '';
    userEmail = typeof raw.userEmail === 'string' ? raw.userEmail.trim().toLowerCase() : '';
    userId = typeof raw.userId === 'string' ? raw.userId.trim() : '';
    role = raw.role || 'WORKER';
    employeeCode =
      typeof raw.employeeCode === 'string' && raw.employeeCode.trim()
        ? raw.employeeCode.trim()
        : null;
    createNewUser = Boolean(raw.createNewUser);
    fullName = typeof raw.fullName === 'string' ? raw.fullName.trim() : '';
    password = typeof raw.password === 'string' ? raw.password.trim() : '';
  }

  if (!stationId) {
    return {
      success: false,
      error: 'מזהה תחנה חסר.',
    };
  }

  // Authorization check: Platform Admin or Station Admin of this specific station
  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) => m.station.id === stationId && m.membership.role === 'ADMIN'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: אינך מנהל מורשה עבור תחנה זו.',
    };
  }

  if (!role || !['ADMIN', 'SHIFT_MANAGER', 'WORKER'].includes(role)) {
    return {
      success: false,
      error: 'נא לבחור תפקיד תקין בתחנה (ADMIN, SHIFT_MANAGER או WORKER).',
    };
  }

  // CASE A: Create a brand new auth user and assign to station
  if (createNewUser) {
    if (!userEmail || !userEmail.includes('@')) {
      return {
        success: false,
        error: 'נא להזין כתובת אימייל תקינה עבור המשתמש החדש.',
      };
    }
    if (!fullName || fullName.length < 2) {
      return {
        success: false,
        error: 'נא להזין שם מלא עבור המשתמש החדש (לפחות 2 תווים).',
      };
    }
    if (!password || password.length < 6) {
      return {
        success: false,
        error: 'נא להזין סיסמה בת 6 תווים לפחות.',
      };
    }

    try {
      const adminClient = createAdminClient();

      // Check if user already exists in auth
      const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers();
      if (listErr) {
        throw new Error(`שגיאה בבדיקת משתמשים קיימים: ${listErr.message}`);
      }

      let targetUserId: string;
      const existingUser = listData.users.find((u) => u.email?.toLowerCase() === userEmail);

      if (existingUser) {
        targetUserId = existingUser.id;
        // Update user metadata / password
        await adminClient.auth.admin.updateUserById(targetUserId, {
          password,
          user_metadata: { full_name: fullName },
        });
      } else {
        const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
          email: userEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

        if (createErr || !createData.user) {
          throw new Error(`שגיאה ביצירת משתמש: ${createErr?.message || 'נכשלה יצירת המשתמש'}`);
        }
        targetUserId = createData.user.id;
      }

      // Ensure profile row has email & name
      await adminClient.from('profiles').upsert({
        id: targetUserId,
        email: userEmail,
        full_name: fullName,
        is_active: true,
      });

      // Assign station membership
      await assignStationMember(supabase, {
        stationId,
        userId: targetUserId,
        role,
        employeeCode,
      });

      revalidatePath('/');
      revalidatePath('/stations');
      revalidatePath(`/stations/${stationId}`);
      revalidatePath(`/stations/${stationId}/staff`);

      return {
        success: true,
        stationId,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'שגיאה ביצירת והקצאת המשתמש.',
      };
    }
  }

  // CASE B: Assign existing user by userId or email
  if (!userEmail && !userId) {
    return {
      success: false,
      error: 'נא לבחור משתמש מהרשימה או להזין כתובת אימייל.',
    };
  }

  try {
    await assignStationMember(supabase, {
      stationId,
      email: userEmail || undefined,
      userId: userId || undefined,
      role,
      employeeCode,
    });

    revalidatePath('/');
    revalidatePath('/stations');
    revalidatePath(`/stations/${stationId}`);
    revalidatePath(`/stations/${stationId}/staff`);

    return {
      success: true,
      stationId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בהקצאת משתמש לתחנה.',
    };
  }
}

export async function removeStationMemberAction(
  stationId: string,
  membershipId: string
): Promise<StationActionResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    return {
      success: false,
      error: 'נדרשת התחברות למערכת.',
    };
  }

  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) => m.station.id === stationId && m.membership.role === 'ADMIN'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: אינך מנהל מורשה עבור תחנה זו.',
    };
  }

  // Final-admin protection: check if target is last active ADMIN
  if (!isPlatformAdmin) {
    const targetMember = await getStationMemberById(supabase, stationId, membershipId);
    if (
      targetMember &&
      targetMember.membership.role === 'ADMIN' &&
      targetMember.membership.status === 'ACTIVE'
    ) {
      const remainingAdmins = await countActiveStationAdmins(supabase, stationId, membershipId);
      if (remainingAdmins === 0) {
        return {
          success: false,
          error: 'לא ניתן להסיר את מנהל התחנה הפעיל האחרון. יש להקצות מנהל תחנה פעיל נוסף תחילה.',
        };
      }
    }
  }

  try {
    await removeStationMember(supabase, membershipId, stationId);

    revalidatePath('/');
    revalidatePath('/stations');
    revalidatePath(`/stations/${stationId}`);
    revalidatePath(`/stations/${stationId}/staff`);

    return {
      success: true,
      stationId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בהסרת הרשאת המשתמש מהתחנה.',
    };
  }
}

export async function updateMemberRoleAction(
  stationId: string,
  membershipId: string,
  newRole: StationRole
): Promise<StationActionResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    return {
      success: false,
      error: 'נדרשת התחברות למערכת.',
    };
  }

  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) => m.station.id === stationId && m.membership.role === 'ADMIN'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: אינך מנהל מורשה עבור תחנה זו.',
    };
  }

  if (!['ADMIN', 'SHIFT_MANAGER', 'WORKER'].includes(newRole)) {
    return {
      success: false,
      error: 'תפקיד לא חוקי.',
    };
  }

  // Final-admin protection: cannot demote last active ADMIN
  if (!isPlatformAdmin && newRole !== 'ADMIN') {
    const targetMember = await getStationMemberById(supabase, stationId, membershipId);
    if (
      targetMember &&
      targetMember.membership.role === 'ADMIN' &&
      targetMember.membership.status === 'ACTIVE'
    ) {
      const remainingAdmins = await countActiveStationAdmins(supabase, stationId, membershipId);
      if (remainingAdmins === 0) {
        return {
          success: false,
          error:
            'לא ניתן לשנות את תפקידו של מנהל התחנה הפעיל האחרון. יש להקצות מנהל תחנה פעיל נוסף תחילה.',
        };
      }
    }
  }

  try {
    await updateStationMemberRole(supabase, {
      stationId,
      membershipId,
      role: newRole,
    });

    revalidatePath('/');
    revalidatePath('/stations');
    revalidatePath(`/stations/${stationId}`);
    revalidatePath(`/stations/${stationId}/staff`);

    return {
      success: true,
      stationId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בעדכון תפקיד איש הצוות.',
    };
  }
}

export async function updateMemberStatusAction(
  stationId: string,
  membershipId: string,
  newStatus: MembershipStatus
): Promise<StationActionResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    return {
      success: false,
      error: 'נדרשת התחברות למערכת.',
    };
  }

  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) => m.station.id === stationId && m.membership.role === 'ADMIN'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: אינך מנהל מורשה עבור תחנה זו.',
    };
  }

  if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(newStatus)) {
    return {
      success: false,
      error: 'סטטוס לא חוקי.',
    };
  }

  // Final-admin protection: cannot deactivate or suspend last active ADMIN
  if (!isPlatformAdmin && newStatus !== 'ACTIVE') {
    const targetMember = await getStationMemberById(supabase, stationId, membershipId);
    if (
      targetMember &&
      targetMember.membership.role === 'ADMIN' &&
      targetMember.membership.status === 'ACTIVE'
    ) {
      const remainingAdmins = await countActiveStationAdmins(supabase, stationId, membershipId);
      if (remainingAdmins === 0) {
        return {
          success: false,
          error:
            'לא ניתן להשבית או להשעות את מנהל התחנה הפעיל האחרון. יש להקצות מנהל תחנה פעיל נוסף תחילה.',
        };
      }
    }
  }

  try {
    await updateStationMemberStatus(supabase, {
      stationId,
      membershipId,
      status: newStatus,
    });

    revalidatePath('/');
    revalidatePath('/stations');
    revalidatePath(`/stations/${stationId}`);
    revalidatePath(`/stations/${stationId}/staff`);

    return {
      success: true,
      stationId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס איש הצוות.',
    };
  }
}

export async function updateStationTolerancesAction(
  stationId: string,
  _prevState: StationActionResult | null,
  formData: FormData
): Promise<StationActionResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    return {
      success: false,
      error: 'נדרשת התחברות למערכת.',
    };
  }

  const isPlatformAdmin = context.isPlatformAdmin;
  const isStationAdmin = context.memberships.some(
    (m) => m.station.id === stationId && m.membership.role === 'ADMIN'
  );

  if (!isPlatformAdmin && !isStationAdmin) {
    return {
      success: false,
      error: 'הרשאה נדחתה: אינך מנהל מורשה עבור תחנה זו.',
    };
  }

  const rawLate = formData.get('allowedLateMinutes');
  const rawEarly = formData.get('allowedEarlyLeaveMinutes');
  const rawLeftOpen = formData.get('leftOpenWarningHours');

  const allowedLateMinutes = parseInt(String(rawLate), 10);
  const allowedEarlyLeaveMinutes = parseInt(String(rawEarly), 10);
  const leftOpenWarningHours = parseInt(String(rawLeftOpen), 10);

  if (isNaN(allowedLateMinutes) || allowedLateMinutes < 0 || allowedLateMinutes > 120) {
    return {
      success: false,
      error: 'איחור מותר חייב להיות בין 0 ל-120 דקות.',
    };
  }

  if (
    isNaN(allowedEarlyLeaveMinutes) ||
    allowedEarlyLeaveMinutes < 0 ||
    allowedEarlyLeaveMinutes > 120
  ) {
    return {
      success: false,
      error: 'יציאה מוקדמת מותרת חייבת להיות בין 0 ל-120 דקות.',
    };
  }

  if (isNaN(leftOpenWarningHours) || leftOpenWarningHours < 1 || leftOpenWarningHours > 48) {
    return {
      success: false,
      error: 'שעות התראת משמרת פתוחה חייבות להיות בין שעה אחת ל-48 שעות.',
    };
  }

  try {
    await updateStation(supabase, stationId, {
      allowedLateMinutes,
      allowedEarlyLeaveMinutes,
      leftOpenWarningHours,
    });

    revalidatePath('/');
    revalidatePath('/stations');
    revalidatePath(`/stations/${stationId}`);
    revalidatePath(`/stations/${stationId}/exceptions`);
    revalidatePath(`/stations/${stationId}/attendance`);

    return {
      success: true,
      stationId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'שגיאה בעדכון הגדרות סבילות נוכחות.',
    };
  }
}
