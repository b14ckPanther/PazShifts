-- ============================================================================
-- YellowShifts Migration: 20260925000025_performance_rpcs.sql
-- Description: Authoritative latency optimization RPCs to collapse sequential WAN waves
--              Preserves all security boundaries, RLS, and auth.uid() isolation.
-- ============================================================================

-- 1. Single-round-trip user context bootstrap
CREATE OR REPLACE FUNCTION public.get_authenticated_user_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile jsonb;
    v_is_platform_admin boolean := false;
    v_memberships jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Profile
    SELECT to_jsonb(p) INTO v_profile
    FROM public.profiles p
    WHERE p.id = v_user_id;

    -- Platform admin check
    SELECT EXISTS(
        SELECT 1 FROM public.platform_admins pa
        WHERE pa.user_id = v_user_id AND pa.is_active = true
    ) INTO v_is_platform_admin;

    -- Station memberships with joined station details
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', sm.id,
                'station_id', sm.station_id,
                'user_id', sm.user_id,
                'role', sm.role,
                'status', sm.status,
                'employee_code', sm.employee_code,
                'created_at', sm.created_at,
                'updated_at', sm.updated_at,
                'stations', to_jsonb(s)
            )
            ORDER BY sm.created_at ASC
        ),
        '[]'::jsonb
    ) INTO v_memberships
    FROM public.station_memberships sm
    JOIN public.stations s ON s.id = sm.station_id
    WHERE sm.user_id = v_user_id
      AND sm.status = 'ACTIVE'
      AND s.is_active = true;

    RETURN jsonb_build_object(
        'user_id', v_user_id,
        'profile', v_profile,
        'is_platform_admin', v_is_platform_admin,
        'memberships', v_memberships
    );
END;
$$;

-- 2. Single-round-trip schedule workspace bootstrap
CREATE OR REPLACE FUNCTION public.get_station_schedule_workspace(
    p_station_id uuid,
    p_week_start date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_can_access boolean := false;
    v_schedule jsonb := NULL;
    v_templates jsonb := '[]'::jsonb;
    v_members jsonb := '[]'::jsonb;
    v_availabilities jsonb := '[]'::jsonb;
    v_schedule_id uuid;
BEGIN
    IF v_user_id IS NULL OR p_station_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Access check: platform admin or active station member
    SELECT (
        public.is_platform_admin(v_user_id)
        OR EXISTS (
            SELECT 1 FROM public.station_memberships sm
            WHERE sm.station_id = p_station_id
              AND sm.user_id = v_user_id
              AND sm.status = 'ACTIVE'
        )
    ) INTO v_can_access;

    IF NOT v_can_access THEN
        RETURN NULL;
    END IF;

    -- A. Schedule for this week
    SELECT s.id INTO v_schedule_id
    FROM public.schedules s
    WHERE s.station_id = p_station_id AND s.week_start_date = p_week_start;

    IF v_schedule_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'id', s.id,
            'station_id', s.station_id,
            'week_start_date', s.week_start_date,
            'status', s.status,
            'created_by', s.created_by,
            'created_at', s.created_at,
            'updated_at', s.updated_at,
            'scheduled_shifts', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ss.id,
                        'schedule_id', ss.schedule_id,
                        'station_id', ss.station_id,
                        'shift_template_id', ss.shift_template_id,
                        'shift_date', ss.shift_date,
                        'start_at', ss.start_at,
                        'end_at', ss.end_at,
                        'notes', ss.notes,
                        'created_at', ss.created_at,
                        'updated_at', ss.updated_at,
                        'shift_templates', (
                            SELECT jsonb_build_object('name', st.name)
                            FROM public.shift_templates st
                            WHERE st.id = ss.shift_template_id
                        ),
                        'shift_assignments', COALESCE((
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', sa.id,
                                    'scheduled_shift_id', sa.scheduled_shift_id,
                                    'station_id', sa.station_id,
                                    'station_membership_id', sa.station_membership_id,
                                    'status', sa.status,
                                    'created_at', sa.created_at,
                                    'updated_at', sa.updated_at,
                                    'station_memberships', jsonb_build_object(
                                        'id', sm.id,
                                        'role', sm.role,
                                        'status', sm.status,
                                        'employee_code', sm.employee_code,
                                        'profiles', to_jsonb(p)
                                    )
                                )
                                ORDER BY sa.created_at ASC
                            )
                            FROM public.shift_assignments sa
                            JOIN public.station_memberships sm ON sm.id = sa.station_membership_id
                            JOIN public.profiles p ON p.id = sm.user_id
                            WHERE sa.scheduled_shift_id = ss.id
                        ), '[]'::jsonb)
                    )
                    ORDER BY ss.shift_date ASC, ss.start_at ASC
                )
                FROM public.scheduled_shifts ss
                WHERE ss.schedule_id = s.id
            ), '[]'::jsonb)
        ) INTO v_schedule
        FROM public.schedules s
        WHERE s.id = v_schedule_id;
    END IF;

    -- B. Active templates
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.display_order ASC, t.start_time ASC), '[]'::jsonb)
    INTO v_templates
    FROM public.shift_templates t
    WHERE t.station_id = p_station_id AND t.is_active = true;

    -- C. Active station members with profiles
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', sm.id,
                'station_id', sm.station_id,
                'user_id', sm.user_id,
                'role', sm.role,
                'status', sm.status,
                'employee_code', sm.employee_code,
                'created_at', sm.created_at,
                'updated_at', sm.updated_at,
                'profiles', to_jsonb(p)
            )
            ORDER BY sm.created_at ASC
        ),
        '[]'::jsonb
    ) INTO v_members
    FROM public.station_memberships sm
    JOIN public.profiles p ON p.id = sm.user_id
    WHERE sm.station_id = p_station_id AND sm.status = 'ACTIVE';

    -- D. Weekly availability with entries
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', aw.id,
                'station_id', aw.station_id,
                'station_membership_id', aw.station_membership_id,
                'week_start_date', aw.week_start_date,
                'notes', aw.notes,
                'submitted_at', aw.submitted_at,
                'updated_at', aw.updated_at,
                'availability_entries', COALESCE((
                    SELECT jsonb_agg(to_jsonb(ae) ORDER BY ae.date ASC)
                    FROM public.availability_entries ae
                    WHERE ae.availability_week_id = aw.id
                ), '[]'::jsonb)
            )
        ),
        '[]'::jsonb
    ) INTO v_availabilities
    FROM public.availability_weeks aw
    WHERE aw.station_id = p_station_id AND aw.week_start_date = p_week_start;

    RETURN jsonb_build_object(
        'schedule', v_schedule,
        'templates', v_templates,
        'members', v_members,
        'availabilities', v_availabilities
    );
END;
$$;

-- 3. Atomic schedule worker assignment RPC
CREATE OR REPLACE FUNCTION public.assign_worker_to_shift_rpc(
    p_station_id uuid,
    p_shift_id uuid,
    p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_assignment_id uuid;
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'נדרשת התחברות למערכת';
    END IF;

    -- Permission check: caller must have scheduling rights on this station
    IF NOT public.can_manage_station_schedule(p_station_id, v_user_id) THEN
        RAISE EXCEPTION 'אין לך הרשאה לערוך סידור עבודה בתחנה זו';
    END IF;

    -- Validate shift belongs to station
    IF NOT EXISTS (
        SELECT 1 FROM public.scheduled_shifts
        WHERE id = p_shift_id AND station_id = p_station_id
    ) THEN
        RAISE EXCEPTION 'המשמרת אינה שייכת לתחנה המבוקשת';
    END IF;

    -- Validate membership belongs to station and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.station_memberships
        WHERE id = p_membership_id AND station_id = p_station_id AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'העובד אינו חבר פעיל בתחנה';
    END IF;

    -- Insert assignment (ON CONFLICT DO NOTHING to ensure idempotence)
    INSERT INTO public.shift_assignments (
        scheduled_shift_id,
        station_id,
        station_membership_id,
        status
    )
    VALUES (
        p_shift_id,
        p_station_id,
        p_membership_id,
        'ASSIGNED'
    )
    ON CONFLICT (scheduled_shift_id, station_membership_id)
    DO UPDATE SET status = 'ASSIGNED', updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_assignment_id;

    -- Return formatted assignment with membership and profile
    SELECT jsonb_build_object(
        'id', sa.id,
        'scheduled_shift_id', sa.scheduled_shift_id,
        'station_id', sa.station_id,
        'station_membership_id', sa.station_membership_id,
        'status', sa.status,
        'created_at', sa.created_at,
        'updated_at', sa.updated_at,
        'station_memberships', jsonb_build_object(
            'id', sm.id,
            'role', sm.role,
            'status', sm.status,
            'employee_code', sm.employee_code,
            'profiles', to_jsonb(p)
        )
    ) INTO v_result
    FROM public.shift_assignments sa
    JOIN public.station_memberships sm ON sm.id = sa.station_membership_id
    JOIN public.profiles p ON p.id = sm.user_id
    WHERE sa.id = v_assignment_id;

    RETURN v_result;
END;
$$;

-- 4. Atomic schedule worker assignment removal RPC
CREATE OR REPLACE FUNCTION public.remove_worker_from_shift_rpc(
    p_station_id uuid,
    p_assignment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'נדרשת התחברות למערכת';
    END IF;

    -- Permission check
    IF NOT public.can_manage_station_schedule(p_station_id, v_user_id) THEN
        RAISE EXCEPTION 'אין לך הרשאה לערוך סידור עבודה בתחנה זו';
    END IF;

    -- Delete assignment scoped to station
    DELETE FROM public.shift_assignments
    WHERE id = p_assignment_id AND station_id = p_station_id;

    RETURN true;
END;
$$;
