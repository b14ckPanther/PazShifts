'use server';

import { cookies } from 'next/headers';
import {
  createServerSupabaseClient,
  resolveStationByNfcToken,
  getWorkerActiveAttendance,
  getWorkerActiveAttendanceAnywhere,
} from '@yellowshifts/database';
import type { AttendanceRecord } from '@yellowshifts/types';

interface RefreshResult {
  authenticated: boolean;
  activeRecord: AttendanceRecord | null;
  crossStationConflict: { stationName?: string } | null;
  scheduledShift: {
    id: string;
    shift_date: string;
    start_at: string;
    end_at: string;
    templateName?: string;
  } | null;
}

/**
 * Server action to re-fetch the latest NFC attendance state.
 * Called by the client on visibility change, mount, and after actions
 * to prevent stale client state.
 */
export async function refreshNfcAttendanceState(
  nfcToken: string,
  membershipId: string
): Promise<RefreshResult> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authenticated: false,
      activeRecord: null,
      crossStationConflict: null,
      scheduledShift: null,
    };
  }

  const station = await resolveStationByNfcToken(supabase, nfcToken);
  if (!station) {
    return {
      authenticated: true,
      activeRecord: null,
      crossStationConflict: null,
      scheduledShift: null,
    };
  }

  // Check cross-station conflict
  const activeAnywhere = await getWorkerActiveAttendanceAnywhere(supabase, user.id);
  const crossStationConflict =
    activeAnywhere && activeAnywhere.station_id !== station.id
      ? { stationName: activeAnywhere.station_name }
      : null;

  // Check active at this station
  const activeAtStation: AttendanceRecord | null =
    activeAnywhere && activeAnywhere.station_id === station.id
      ? (activeAnywhere as AttendanceRecord)
      : await getWorkerActiveAttendance(supabase, membershipId);

  // Find scheduled shift
  let scheduledShift = null;
  if (!activeAtStation) {
    const { data: assignments } = await supabase
      .from('shift_assignments')
      .select(
        `
        scheduled_shifts!inner (
          id,
          shift_date,
          start_at,
          end_at,
          shift_templates:shift_template_id (
            name
          )
        )
      `
      )
      .eq('station_id', station.id)
      .eq('station_membership_id', membershipId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignmentList = (assignments || []) as any[];
    if (assignmentList.length > 0) {
      const candidate = assignmentList[0]?.scheduled_shifts;
      if (candidate) {
        scheduledShift = {
          id: candidate.id,
          shift_date: candidate.shift_date,
          start_at: candidate.start_at,
          end_at: candidate.end_at,
          templateName: candidate.shift_templates?.name,
        };
      }
    }
  }

  return {
    authenticated: true,
    activeRecord: activeAtStation,
    crossStationConflict,
    scheduledShift,
  };
}
