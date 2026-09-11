-- ============================================================================
-- YellowShifts Migration: 20260906000004_phase5_shift_structure_and_schedules.sql
-- Description: Phase 5 — Shift Structure, Weekly Schedules & Assignment Data Model
-- ============================================================================

-- 1. Create Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_status') THEN
        CREATE TYPE public.schedule_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_assignment_status') THEN
        CREATE TYPE public.shift_assignment_status AS ENUM ('ASSIGNED', 'CONFIRMED', 'DECLINED');
    END IF;
END $$;

-- 2. Shift Templates Table (Station-scoped, independent from station opening hours, 24/7 support)
CREATE TABLE IF NOT EXISTS public.shift_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_shift_template_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT chk_shift_template_times_diff CHECK (start_time != end_time)
);

-- 3. Weekly Schedules Table (Station-scoped, Monday week boundary, unique per station+week)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    status public.schedule_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_station_week UNIQUE (station_id, week_start_date),
    CONSTRAINT chk_week_start_is_monday CHECK (EXTRACT(ISODOW FROM week_start_date) = 1)
);

-- 4. Scheduled Shifts Table (Real shift instances inside a weekly schedule)
-- Stores snapshot start_at and end_at timestamps to guarantee historical integrity
CREATE TABLE IF NOT EXISTS public.scheduled_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
    shift_template_id UUID REFERENCES public.shift_templates(id) ON DELETE SET NULL,
    shift_date DATE NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_scheduled_shift_times CHECK (end_at > start_at)
);

-- 5. Shift Assignments Table (Links scheduled shifts to active station members)
CREATE TABLE IF NOT EXISTS public.shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_shift_id UUID NOT NULL REFERENCES public.scheduled_shifts(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
    station_membership_id UUID NOT NULL REFERENCES public.station_memberships(id) ON DELETE RESTRICT,
    status public.shift_assignment_status NOT NULL DEFAULT 'ASSIGNED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_shift_membership UNIQUE (scheduled_shift_id, station_membership_id)
);

-- 6. Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_shift_templates_station ON public.shift_templates(station_id, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_schedules_station_week ON public.schedules(station_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_schedule ON public.scheduled_shifts(schedule_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_station ON public.scheduled_shifts(station_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift ON public.shift_assignments(scheduled_shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_membership ON public.shift_assignments(station_membership_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_station ON public.shift_assignments(station_id);

-- 7. Authorization Helper Functions
CREATE OR REPLACE FUNCTION public.can_manage_station_schedule(p_station_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL OR p_station_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN public.is_platform_admin(p_user_id)
        OR public.has_station_role(p_station_id, 'ADMIN'::public.station_role, p_user_id)
        OR public.has_station_role(p_station_id, 'SHIFT_MANAGER'::public.station_role, p_user_id);
END;
$$;

-- 8. Integrity Validation Triggers
-- 8a. Scheduled Shift Validation: ensures shift station matches schedule station & template station
CREATE OR REPLACE FUNCTION public.validate_scheduled_shift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schedule_station UUID;
    v_template_station UUID;
BEGIN
    -- Verify Schedule station match
    SELECT station_id INTO v_schedule_station
    FROM public.schedules
    WHERE id = NEW.schedule_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule not found for scheduled shift';
    END IF;

    IF NEW.station_id != v_schedule_station THEN
        RAISE EXCEPTION 'Scheduled shift station (%) does not match schedule station (%)', NEW.station_id, v_schedule_station;
    END IF;

    -- Verify Shift Template station match (if template is referenced)
    IF NEW.shift_template_id IS NOT NULL THEN
        SELECT station_id INTO v_template_station
        FROM public.shift_templates
        WHERE id = NEW.shift_template_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Referenced shift template not found';
        END IF;

        IF v_template_station != NEW.station_id THEN
            RAISE EXCEPTION 'Shift template station (%) does not match scheduled shift station (%)', v_template_station, NEW.station_id;
        END IF;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_scheduled_shift ON public.scheduled_shifts;
CREATE TRIGGER trg_validate_scheduled_shift
    BEFORE INSERT OR UPDATE ON public.scheduled_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_scheduled_shift();

-- 8b. Shift Assignment Validation: ensures worker belongs to same station, is ACTIVE, and syncs station_id
CREATE OR REPLACE FUNCTION public.validate_shift_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_shift_station UUID;
    v_mem_station UUID;
    v_mem_status public.membership_status;
BEGIN
    -- Resolve station from scheduled shift
    SELECT station_id INTO v_shift_station
    FROM public.scheduled_shifts
    WHERE id = NEW.scheduled_shift_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scheduled shift not found for assignment';
    END IF;

    -- Auto-populate or verify assignment station_id
    NEW.station_id := v_shift_station;

    -- Resolve worker membership
    SELECT station_id, status INTO v_mem_station, v_mem_status
    FROM public.station_memberships
    WHERE id = NEW.station_membership_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Station membership not found for assignment';
    END IF;

    -- Station isolation check
    IF v_mem_station != NEW.station_id THEN
        RAISE EXCEPTION 'Station membership belongs to station % but shift belongs to station %', v_mem_station, NEW.station_id;
    END IF;

    -- Membership status check
    IF v_mem_status != 'ACTIVE'::public.membership_status THEN
        RAISE EXCEPTION 'Only ACTIVE station memberships may be assigned to shifts (current status: %)', v_mem_status;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shift_assignment ON public.shift_assignments;
CREATE TRIGGER trg_validate_shift_assignment
    BEFORE INSERT OR UPDATE ON public.shift_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_shift_assignment();

-- 9. Row Level Security (RLS) Activation
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

-- 10. Explicit Schema & Table Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_assignments TO authenticated;

-- 11. RLS Policies: shift_templates
DROP POLICY IF EXISTS "shift_templates_select_policy" ON public.shift_templates;
CREATE POLICY "shift_templates_select_policy"
    ON public.shift_templates
    FOR SELECT
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.has_station_membership(station_id, auth.uid())
    );

DROP POLICY IF EXISTS "shift_templates_insert_policy" ON public.shift_templates;
CREATE POLICY "shift_templates_insert_policy"
    ON public.shift_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_station_admin(station_id, auth.uid())
    );

DROP POLICY IF EXISTS "shift_templates_update_policy" ON public.shift_templates;
CREATE POLICY "shift_templates_update_policy"
    ON public.shift_templates
    FOR UPDATE
    TO authenticated
    USING (
        public.is_station_admin(station_id, auth.uid())
    )
    WITH CHECK (
        public.is_station_admin(station_id, auth.uid())
    );

DROP POLICY IF EXISTS "shift_templates_delete_policy" ON public.shift_templates;
CREATE POLICY "shift_templates_delete_policy"
    ON public.shift_templates
    FOR DELETE
    TO authenticated
    USING (
        public.is_station_admin(station_id, auth.uid())
    );

-- 12. RLS Policies: schedules
DROP POLICY IF EXISTS "schedules_select_policy" ON public.schedules;
CREATE POLICY "schedules_select_policy"
    ON public.schedules
    FOR SELECT
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.is_station_admin(station_id, auth.uid())
        OR public.has_station_role(station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
        OR (
            public.has_station_membership(station_id, auth.uid())
            AND status IN ('PUBLISHED', 'ARCHIVED')
        )
    );

DROP POLICY IF EXISTS "schedules_insert_policy" ON public.schedules;
CREATE POLICY "schedules_insert_policy"
    ON public.schedules
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.can_manage_station_schedule(station_id, auth.uid())
    );

DROP POLICY IF EXISTS "schedules_update_policy" ON public.schedules;
CREATE POLICY "schedules_update_policy"
    ON public.schedules
    FOR UPDATE
    TO authenticated
    USING (
        public.is_station_admin(station_id, auth.uid())
        OR (
            public.has_station_role(station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
            AND status = 'DRAFT'
        )
    )
    WITH CHECK (
        public.is_station_admin(station_id, auth.uid())
        OR (
            public.has_station_role(station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
            AND status = 'DRAFT'
        )
    );

DROP POLICY IF EXISTS "schedules_delete_policy" ON public.schedules;
CREATE POLICY "schedules_delete_policy"
    ON public.schedules
    FOR DELETE
    TO authenticated
    USING (
        public.is_station_admin(station_id, auth.uid())
    );

-- 13. RLS Policies: scheduled_shifts
DROP POLICY IF EXISTS "scheduled_shifts_select_policy" ON public.scheduled_shifts;
CREATE POLICY "scheduled_shifts_select_policy"
    ON public.scheduled_shifts
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.schedules s
            WHERE s.id = scheduled_shifts.schedule_id
              AND (
                  public.is_platform_admin(auth.uid())
                  OR public.is_station_admin(s.station_id, auth.uid())
                  OR public.has_station_role(s.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                  OR (
                      public.has_station_membership(s.station_id, auth.uid())
                      AND s.status IN ('PUBLISHED', 'ARCHIVED')
                  )
              )
        )
    );

DROP POLICY IF EXISTS "scheduled_shifts_insert_policy" ON public.scheduled_shifts;
CREATE POLICY "scheduled_shifts_insert_policy"
    ON public.scheduled_shifts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.schedules s
            WHERE s.id = scheduled_shifts.schedule_id
              AND (
                  public.is_station_admin(s.station_id, auth.uid())
                  OR (
                      public.has_station_role(s.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                      AND s.status = 'DRAFT'
                  )
              )
        )
    );

DROP POLICY IF EXISTS "scheduled_shifts_update_policy" ON public.scheduled_shifts;
CREATE POLICY "scheduled_shifts_update_policy"
    ON public.scheduled_shifts
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.schedules s
            WHERE s.id = scheduled_shifts.schedule_id
              AND (
                  public.is_station_admin(s.station_id, auth.uid())
                  OR (
                      public.has_station_role(s.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                      AND s.status = 'DRAFT'
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.schedules s
            WHERE s.id = scheduled_shifts.schedule_id
              AND (
                  public.is_station_admin(s.station_id, auth.uid())
                  OR (
                      public.has_station_role(s.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                      AND s.status = 'DRAFT'
                  )
              )
        )
    );

DROP POLICY IF EXISTS "scheduled_shifts_delete_policy" ON public.scheduled_shifts;
CREATE POLICY "scheduled_shifts_delete_policy"
    ON public.scheduled_shifts
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.schedules s
            WHERE s.id = scheduled_shifts.schedule_id
              AND (
                  public.is_station_admin(s.station_id, auth.uid())
                  OR (
                      public.has_station_role(s.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                      AND s.status = 'DRAFT'
                  )
              )
        )
    );

-- 14. RLS Policies: shift_assignments
DROP POLICY IF EXISTS "shift_assignments_select_policy" ON public.shift_assignments;
CREATE POLICY "shift_assignments_select_policy"
    ON public.shift_assignments
    FOR SELECT
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.is_station_admin(station_id, auth.uid())
        OR public.has_station_role(station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.station_memberships m
            WHERE m.id = shift_assignments.station_membership_id
              AND m.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.scheduled_shifts ss
            JOIN public.schedules s ON ss.schedule_id = s.id
            WHERE ss.id = shift_assignments.scheduled_shift_id
              AND s.status IN ('PUBLISHED', 'ARCHIVED')
              AND public.has_station_membership(shift_assignments.station_id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "shift_assignments_insert_policy" ON public.shift_assignments;
CREATE POLICY "shift_assignments_insert_policy"
    ON public.shift_assignments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.scheduled_shifts ss
            JOIN public.schedules s ON ss.schedule_id = s.id
            WHERE ss.id = shift_assignments.scheduled_shift_id
              AND (
                  public.is_station_admin(shift_assignments.station_id, auth.uid())
                  OR (
                      public.has_station_role(shift_assignments.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                      AND s.status = 'DRAFT'
                  )
              )
        )
    );

DROP POLICY IF EXISTS "shift_assignments_update_policy" ON public.shift_assignments;
CREATE POLICY "shift_assignments_update_policy"
    ON public.shift_assignments
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.scheduled_shifts ss
            JOIN public.schedules s ON ss.schedule_id = s.id
            WHERE ss.id = shift_assignments.scheduled_shift_id
              AND (
                  public.is_station_admin(shift_assignments.station_id, auth.uid())
                  OR (
                      public.has_station_role(shift_assignments.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                      AND s.status = 'DRAFT'
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.scheduled_shifts ss
            JOIN public.schedules s ON ss.schedule_id = s.id
            WHERE ss.id = shift_assignments.scheduled_shift_id
              AND (
                  public.is_station_admin(shift_assignments.station_id, auth.uid())
                  OR (
                      public.has_station_role(shift_assignments.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                      AND s.status = 'DRAFT'
                  )
              )
        )
    );

DROP POLICY IF EXISTS "shift_assignments_delete_policy" ON public.shift_assignments;
CREATE POLICY "shift_assignments_delete_policy"
    ON public.shift_assignments
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.scheduled_shifts ss
            JOIN public.schedules s ON ss.schedule_id = s.id
            WHERE ss.id = shift_assignments.scheduled_shift_id
              AND (
                  public.is_station_admin(shift_assignments.station_id, auth.uid())
                  OR (
                      public.has_station_role(shift_assignments.station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid())
                      AND s.status = 'DRAFT'
                  )
              )
        )
    );
