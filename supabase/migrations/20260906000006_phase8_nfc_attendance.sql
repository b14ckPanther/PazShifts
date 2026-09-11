-- ============================================================================
-- YellowShifts Migration: 20260906000006_phase8_nfc_attendance.sql
-- Description: Phase 8 — NFC Attendance, Clock-In / Clock-Out & Station Verification
-- ============================================================================

-- 1. Add NFC Public Token to Stations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'stations' 
          AND column_name = 'nfc_public_token'
    ) THEN
        ALTER TABLE public.stations 
        ADD COLUMN nfc_public_token TEXT;
    END IF;
END $$;

-- Backfill existing stations with a cryptographically secure random hex token
UPDATE public.stations
SET nfc_public_token = replace(gen_random_uuid()::text, '-', '')
WHERE nfc_public_token IS NULL;

-- Enforce NOT NULL and DEFAULT for new stations
ALTER TABLE public.stations 
ALTER COLUMN nfc_public_token SET NOT NULL;

ALTER TABLE public.stations 
ALTER COLUMN nfc_public_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

-- Unique index for rapid non-guessable lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_stations_nfc_public_token 
ON public.stations(nfc_public_token);

-- 2. Create Attendance Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE public.attendance_status AS ENUM ('ACTIVE', 'COMPLETED', 'FLAGGED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_source') THEN
        CREATE TYPE public.attendance_source AS ENUM ('NFC', 'MANUAL_ADMIN');
    END IF;
END $$;

-- 3. Create Attendance Records Table
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
    station_membership_id UUID NOT NULL REFERENCES public.station_memberships(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    scheduled_shift_id UUID REFERENCES public.scheduled_shifts(id) ON DELETE SET NULL,
    clock_in_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    clock_out_at TIMESTAMPTZ,
    status public.attendance_status NOT NULL DEFAULT 'ACTIVE',
    clock_in_source public.attendance_source NOT NULL DEFAULT 'NFC',
    clock_out_source public.attendance_source,
    corrected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    correction_reason TEXT,
    corrected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_clock_out_after_clock_in CHECK (clock_out_at IS NULL OR clock_out_at >= clock_in_at)
);

-- 4. Database-level Constraints for Single Active Attendance
-- Rule: A station membership must NEVER have multiple ACTIVE attendance records simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_single_active 
ON public.attendance_records (station_membership_id) 
WHERE (status = 'ACTIVE');

-- Rule: A user must NEVER have multiple ACTIVE attendance records across ANY station simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_single_active 
ON public.attendance_records (user_id) 
WHERE (status = 'ACTIVE');

-- Performance and Operational Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_station_clock_in 
ON public.attendance_records (station_id, clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_station_status 
ON public.attendance_records (station_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_user_history 
ON public.attendance_records (user_id, clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_scheduled_shift 
ON public.attendance_records (scheduled_shift_id) 
WHERE scheduled_shift_id IS NOT NULL;

-- 5. Helper Functions & RPCs

-- Secure RPC to resolve station by NFC public token without exposing sensitive internal station fields
CREATE OR REPLACE FUNCTION public.resolve_station_by_nfc_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    code TEXT,
    name TEXT,
    address TEXT,
    timezone TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_token IS NULL OR char_length(trim(p_token)) = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        s.id,
        s.code,
        s.name,
        s.address,
        s.timezone,
        s.is_active
    FROM public.stations s
    WHERE s.nfc_public_token = trim(p_token);
END;
$$;

-- Secure RPC to rotate a station's NFC public token (Authorized for Platform Admin and Station Admin)
CREATE OR REPLACE FUNCTION public.rotate_station_nfc_token(p_station_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_token TEXT;
BEGIN
    IF p_station_id IS NULL THEN
        RAISE EXCEPTION 'Station ID is required';
    END IF;

    IF NOT (public.is_platform_admin(auth.uid()) OR public.is_station_admin(p_station_id, auth.uid())) THEN
        RAISE EXCEPTION 'Unauthorized: only platform admin or station admin can rotate NFC tokens';
    END IF;

    v_new_token := replace(gen_random_uuid()::text, '-', '');

    UPDATE public.stations
    SET nfc_public_token = v_new_token,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_station_id;

    RETURN v_new_token;
END;
$$;

-- 6. Row Level Security (RLS)
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Platform Admin: Full read and write access
DROP POLICY IF EXISTS platform_admins_all_attendance ON public.attendance_records;
CREATE POLICY platform_admins_all_attendance
    ON public.attendance_records
    FOR ALL
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

-- Station Admin: Read all attendance for assigned station
DROP POLICY IF EXISTS station_admins_select_attendance ON public.attendance_records;
CREATE POLICY station_admins_select_attendance
    ON public.attendance_records
    FOR SELECT
    TO authenticated
    USING (public.is_station_admin(station_id, auth.uid()));

-- Station Admin: Update attendance for assigned station (auditable corrections)
DROP POLICY IF EXISTS station_admins_update_attendance ON public.attendance_records;
CREATE POLICY station_admins_update_attendance
    ON public.attendance_records
    FOR UPDATE
    TO authenticated
    USING (public.is_station_admin(station_id, auth.uid()))
    WITH CHECK (public.is_station_admin(station_id, auth.uid()));

-- Shift Manager: Read-only access to attendance for assigned station
DROP POLICY IF EXISTS shift_managers_select_attendance ON public.attendance_records;
CREATE POLICY shift_managers_select_attendance
    ON public.attendance_records
    FOR SELECT
    TO authenticated
    USING (public.has_station_role(station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid()));

-- Worker: Read their own attendance records
DROP POLICY IF EXISTS workers_select_own_attendance ON public.attendance_records;
CREATE POLICY workers_select_own_attendance
    ON public.attendance_records
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Worker: Clock-in (insert their own active record with NFC source)
DROP POLICY IF EXISTS workers_insert_own_attendance ON public.attendance_records;
CREATE POLICY workers_insert_own_attendance
    ON public.attendance_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() 
        AND public.has_station_membership(station_id, auth.uid())
        AND status = 'ACTIVE'
        AND clock_in_source = 'NFC'
    );

-- Worker: Clock-out (update their own active record to COMPLETED)
DROP POLICY IF EXISTS workers_update_own_attendance ON public.attendance_records;
CREATE POLICY workers_update_own_attendance
    ON public.attendance_records
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() 
        AND status = 'ACTIVE'
    )
    WITH CHECK (
        user_id = auth.uid() 
        AND status = 'COMPLETED'
        AND clock_out_source = 'NFC'
    );
