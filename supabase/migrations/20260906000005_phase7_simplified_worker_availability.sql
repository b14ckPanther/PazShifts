-- ============================================================================
-- YellowShifts Migration: 20260906000005_phase7_simplified_worker_availability.sql
-- Description: Phase 7 — Simplified Station-Scoped Worker Availability
-- ============================================================================

-- 1. Create Enum for Availability Types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_type') THEN
        CREATE TYPE public.availability_type AS ENUM (
            'ALL_DAY_AVAILABLE',
            'ALL_DAY_UNAVAILABLE',
            'TIME_WINDOW'
        );
    END IF;
END $$;

-- 2. Availability Weeks Table
-- Represents one worker's availability submission for one station and one Monday-starting week
CREATE TABLE IF NOT EXISTS public.availability_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
    station_membership_id UUID NOT NULL REFERENCES public.station_memberships(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_membership_week UNIQUE (station_membership_id, week_start_date),
    CONSTRAINT chk_availability_week_monday CHECK (EXTRACT(ISODOW FROM week_start_date) = 1)
);

-- 3. Availability Entries Table
-- Represents availability for a specific day of that week
CREATE TABLE IF NOT EXISTS public.availability_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    availability_week_id UUID NOT NULL REFERENCES public.availability_weeks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    availability_type public.availability_type NOT NULL,
    start_time TIME,
    end_time TIME,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_week_entry_date UNIQUE (availability_week_id, date),
    CONSTRAINT chk_time_window_times CHECK (
        availability_type != 'TIME_WINDOW' OR (
            start_time IS NOT NULL AND 
            end_time IS NOT NULL AND 
            start_time != end_time
        )
    )
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_availability_weeks_station_week 
    ON public.availability_weeks(station_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_availability_weeks_membership 
    ON public.availability_weeks(station_membership_id);

CREATE INDEX IF NOT EXISTS idx_availability_entries_week 
    ON public.availability_entries(availability_week_id);

CREATE INDEX IF NOT EXISTS idx_availability_entries_date 
    ON public.availability_entries(date);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.availability_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_entries ENABLE ROW LEVEL SECURITY;

-- 6. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_weeks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_entries TO authenticated;

-- 7. RLS Policies: availability_weeks
-- SELECT:
-- - Platform Admin (global)
-- - Station Admin or Shift Manager of the station
-- - The worker owner themselves
DROP POLICY IF EXISTS "availability_weeks_select_policy" ON public.availability_weeks;
CREATE POLICY "availability_weeks_select_policy"
    ON public.availability_weeks
    FOR SELECT
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.is_station_admin(station_id, auth.uid())
        OR public.has_station_role(station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.station_memberships sm
            WHERE sm.id = availability_weeks.station_membership_id
              AND sm.user_id = auth.uid()
        )
    );

-- INSERT:
-- - The worker owner themselves (must be ACTIVE member of that station)
DROP POLICY IF EXISTS "availability_weeks_insert_policy" ON public.availability_weeks;
CREATE POLICY "availability_weeks_insert_policy"
    ON public.availability_weeks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.station_memberships sm
            WHERE sm.id = availability_weeks.station_membership_id
              AND sm.station_id = availability_weeks.station_id
              AND sm.user_id = auth.uid()
              AND sm.status = 'ACTIVE'
        )
    );

-- UPDATE:
-- - The worker owner themselves
DROP POLICY IF EXISTS "availability_weeks_update_policy" ON public.availability_weeks;
CREATE POLICY "availability_weeks_update_policy"
    ON public.availability_weeks
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.station_memberships sm
            WHERE sm.id = availability_weeks.station_membership_id
              AND sm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.station_memberships sm
            WHERE sm.id = availability_weeks.station_membership_id
              AND sm.user_id = auth.uid()
        )
    );

-- DELETE:
-- - The worker owner themselves
DROP POLICY IF EXISTS "availability_weeks_delete_policy" ON public.availability_weeks;
CREATE POLICY "availability_weeks_delete_policy"
    ON public.availability_weeks
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.station_memberships sm
            WHERE sm.id = availability_weeks.station_membership_id
              AND sm.user_id = auth.uid()
        )
    );

-- 8. RLS Policies: availability_entries
-- SELECT:
-- - Inherits visibility of the parent availability_weeks row
DROP POLICY IF EXISTS "availability_entries_select_policy" ON public.availability_entries;
CREATE POLICY "availability_entries_select_policy"
    ON public.availability_entries
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.availability_weeks aw
            WHERE aw.id = availability_entries.availability_week_id
              AND (
                  public.is_platform_admin(auth.uid())
                  OR public.is_station_admin(aw.station_id, auth.uid())
                  OR public.has_station_role(aw.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                  OR EXISTS (
                      SELECT 1
                      FROM public.station_memberships sm
                      WHERE sm.id = aw.station_membership_id
                        AND sm.user_id = auth.uid()
                  )
              )
        )
    );

-- INSERT:
-- - The worker owner of the parent availability_weeks
DROP POLICY IF EXISTS "availability_entries_insert_policy" ON public.availability_entries;
CREATE POLICY "availability_entries_insert_policy"
    ON public.availability_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.availability_weeks aw
            JOIN public.station_memberships sm ON sm.id = aw.station_membership_id
            WHERE aw.id = availability_entries.availability_week_id
              AND sm.user_id = auth.uid()
        )
    );

-- UPDATE:
-- - The worker owner of the parent availability_weeks
DROP POLICY IF EXISTS "availability_entries_update_policy" ON public.availability_entries;
CREATE POLICY "availability_entries_update_policy"
    ON public.availability_entries
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.availability_weeks aw
            JOIN public.station_memberships sm ON sm.id = aw.station_membership_id
            WHERE aw.id = availability_entries.availability_week_id
              AND sm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.availability_weeks aw
            JOIN public.station_memberships sm ON sm.id = aw.station_membership_id
            WHERE aw.id = availability_entries.availability_week_id
              AND sm.user_id = auth.uid()
        )
    );

-- DELETE:
-- - The worker owner of the parent availability_weeks
DROP POLICY IF EXISTS "availability_entries_delete_policy" ON public.availability_entries;
CREATE POLICY "availability_entries_delete_policy"
    ON public.availability_entries
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.availability_weeks aw
            JOIN public.station_memberships sm ON sm.id = aw.station_membership_id
            WHERE aw.id = availability_entries.availability_week_id
              AND sm.user_id = auth.uid()
        )
    );
