-- ============================================================================
-- YellowShifts Migration: 20260906000001_phase2_identity_and_multi_station_rls.sql
-- Description: Phase 2 — Real Schema, Identity, Multi-Station Roles & RLS
-- ============================================================================

-- 1. Create Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'station_role') THEN
        CREATE TYPE public.station_role AS ENUM ('ADMIN', 'SHIFT_MANAGER', 'WORKER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
        CREATE TYPE public.membership_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
    END IF;
END $$;

-- 2. Profiles Table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    preferred_locale TEXT NOT NULL DEFAULT 'he',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Platform Admins Table (Global platform administration scope, completely decoupled from station_id)
CREATE TABLE IF NOT EXISTS public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Stations Table (Real multi-station entities)
CREATE TABLE IF NOT EXISTS public.stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Station Memberships Table (Joins users to stations with scoped role)
CREATE TABLE IF NOT EXISTS public.station_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    role public.station_role NOT NULL DEFAULT 'WORKER',
    status public.membership_status NOT NULL DEFAULT 'ACTIVE',
    employee_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_station_user UNIQUE (station_id, user_id)
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON public.platform_admins(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stations_code ON public.stations(code);
CREATE INDEX IF NOT EXISTS idx_stations_is_active ON public.stations(is_active);
CREATE INDEX IF NOT EXISTS idx_station_memberships_user ON public.station_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_station_memberships_station ON public.station_memberships(station_id);
CREATE INDEX IF NOT EXISTS idx_station_memberships_scope ON public.station_memberships(station_id, user_id, role, status);

-- 7. Automatic Profile Provisioning Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        phone,
        preferred_locale,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'preferred_locale', 'he'),
        true,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Security Definer Authorization Helper Functions
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.platform_admins
        WHERE user_id = p_user_id
          AND is_active = true
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_station_membership(p_station_id UUID, p_user_id UUID DEFAULT auth.uid())
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

    RETURN EXISTS (
        SELECT 1
        FROM public.station_memberships
        WHERE station_id = p_station_id
          AND user_id = p_user_id
          AND status = 'ACTIVE'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_station_role(p_station_id UUID, p_role public.station_role, p_user_id UUID DEFAULT auth.uid())
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

    RETURN EXISTS (
        SELECT 1
        FROM public.station_memberships
        WHERE station_id = p_station_id
          AND user_id = p_user_id
          AND role = p_role
          AND status = 'ACTIVE'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_station_admin(p_station_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.is_platform_admin(p_user_id)
        OR public.has_station_role(p_station_id, 'ADMIN'::public.station_role, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.shares_active_station_with(target_user_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL OR target_user_id IS NULL THEN
        RETURN false;
    END IF;

    IF p_user_id = target_user_id THEN
        RETURN true;
    END IF;

    IF public.is_platform_admin(p_user_id) THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.station_memberships m1
        JOIN public.station_memberships m2 ON m1.station_id = m2.station_id
        WHERE m1.user_id = p_user_id
          AND m2.user_id = target_user_id
          AND m1.status = 'ACTIVE'
          AND m2.status = 'ACTIVE'
    );
END;
$$;

-- 9. Row Level Security (RLS) Activation
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_memberships ENABLE ROW LEVEL SECURITY;

-- 10. Explicit Schema & Function Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT SELECT ON public.stations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_memberships TO authenticated;

-- 11. RLS Policies: profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR public.shares_active_station_with(id, auth.uid())
    );

DROP POLICY IF EXISTS "profiles_update_own_policy" ON public.profiles;
CREATE POLICY "profiles_update_own_policy"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 12. RLS Policies: platform_admins (fail-closed, only self-read for authenticated)
DROP POLICY IF EXISTS "platform_admins_select_self" ON public.platform_admins;
CREATE POLICY "platform_admins_select_self"
    ON public.platform_admins
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND is_active = true);

-- 13. RLS Policies: stations
DROP POLICY IF EXISTS "stations_select_authorized" ON public.stations;
CREATE POLICY "stations_select_authorized"
    ON public.stations
    FOR SELECT
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.has_station_membership(id, auth.uid())
    );

DROP POLICY IF EXISTS "stations_modify_platform_admin" ON public.stations;
CREATE POLICY "stations_modify_platform_admin"
    ON public.stations
    FOR ALL
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

-- 14. RLS Policies: station_memberships
DROP POLICY IF EXISTS "memberships_select_authorized" ON public.station_memberships;
CREATE POLICY "memberships_select_authorized"
    ON public.station_memberships
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_platform_admin(auth.uid())
        OR public.has_station_membership(station_id, auth.uid())
    );

DROP POLICY IF EXISTS "memberships_insert_admin" ON public.station_memberships;
CREATE POLICY "memberships_insert_admin"
    ON public.station_memberships
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_station_admin(station_id, auth.uid())
    );

DROP POLICY IF EXISTS "memberships_update_admin" ON public.station_memberships;
CREATE POLICY "memberships_update_admin"
    ON public.station_memberships
    FOR UPDATE
    TO authenticated
    USING (public.is_station_admin(station_id, auth.uid()))
    WITH CHECK (public.is_station_admin(station_id, auth.uid()));

DROP POLICY IF EXISTS "memberships_delete_admin" ON public.station_memberships;
CREATE POLICY "memberships_delete_admin"
    ON public.station_memberships
    FOR DELETE
    TO authenticated
    USING (public.is_station_admin(station_id, auth.uid()));
