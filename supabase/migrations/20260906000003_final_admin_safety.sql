-- ============================================================================
-- YellowShifts Migration: 20260906000003_final_admin_safety.sql
-- Description: Phase 4 — Enforce Final-Admin Protection on station_memberships
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_station_admin_safety()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_active_admin_count INTEGER;
BEGIN
    -- Platform Admins have global administrative override to resolve stations
    IF public.is_platform_admin(auth.uid()) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Protect active ADMIN from demotion, deactivation, or removal if they are the last active ADMIN
    IF OLD.role = 'ADMIN' AND OLD.status = 'ACTIVE' THEN
        IF (TG_OP = 'DELETE') OR (NEW.role != 'ADMIN') OR (NEW.status != 'ACTIVE') THEN
            SELECT COUNT(*)
            INTO v_active_admin_count
            FROM public.station_memberships
            WHERE station_id = OLD.station_id
              AND role = 'ADMIN'
              AND status = 'ACTIVE'
              AND id != OLD.id;

            IF v_active_admin_count = 0 THEN
                RAISE EXCEPTION 'Cannot demote or remove the last remaining active ADMIN of station % without appointing another active ADMIN first.', OLD.station_id
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_station_admin_safety ON public.station_memberships;
CREATE TRIGGER trg_station_admin_safety
    BEFORE UPDATE OR DELETE ON public.station_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.check_station_admin_safety();
