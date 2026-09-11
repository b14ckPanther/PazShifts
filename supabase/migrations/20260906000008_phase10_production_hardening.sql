-- ============================================================================
-- YellowShifts Migration: 20260906000008_phase10_production_hardening.sql
-- Description: Phase 10 — Production Hardening, RLS Station Update & Performance Indexes
-- ============================================================================

-- 1. Allow Station Admins to update their assigned station's operational settings
-- (including attendance tolerances, contact info, and operational metadata)
-- Platform Admin already has global ALL access via stations_modify_platform_admin
DROP POLICY IF EXISTS "stations_update_station_admin" ON public.stations;
CREATE POLICY "stations_update_station_admin"
    ON public.stations
    FOR UPDATE
    TO authenticated
    USING (public.is_station_admin(id, auth.uid()))
    WITH CHECK (public.is_station_admin(id, auth.uid()));

-- 2. Performance index for real-time station attendance lookups and exception computations
CREATE INDEX IF NOT EXISTS idx_attendance_station_active_lookup
ON public.attendance_records (station_id, status, clock_in_at DESC);

-- 3. Performance index for shift assignments lookup by status and station
CREATE INDEX IF NOT EXISTS idx_shift_assignments_station_status
ON public.shift_assignments (station_id, status);
