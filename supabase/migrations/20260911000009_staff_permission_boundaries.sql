-- Super admins appoint station admins; station admins manage only subordinate staff.
-- Keep historical membership IDs: removal in the application means INACTIVE.
BEGIN;

DROP POLICY IF EXISTS memberships_insert_admin ON public.station_memberships;
CREATE POLICY memberships_insert_admin ON public.station_memberships
FOR INSERT TO authenticated WITH CHECK (
  user_id <> auth.uid() AND (
    public.is_platform_admin(auth.uid()) OR (
      public.is_station_admin(station_id, auth.uid()) AND role IN ('WORKER', 'SHIFT_MANAGER')
    )
  )
);

DROP POLICY IF EXISTS memberships_update_admin ON public.station_memberships;
CREATE POLICY memberships_update_admin ON public.station_memberships
FOR UPDATE TO authenticated
USING (
  user_id <> auth.uid() AND (
    public.is_platform_admin(auth.uid()) OR (
      public.is_station_admin(station_id, auth.uid()) AND role IN ('WORKER', 'SHIFT_MANAGER')
    )
  )
)
WITH CHECK (
  user_id <> auth.uid() AND (
    public.is_platform_admin(auth.uid()) OR (
      public.is_station_admin(station_id, auth.uid()) AND role IN ('WORKER', 'SHIFT_MANAGER')
    )
  )
);

-- No browser session should physically delete a membership and its audit references.
DROP POLICY IF EXISTS memberships_delete_admin ON public.station_memberships;
REVOKE DELETE ON public.station_memberships FROM authenticated;

CREATE OR REPLACE FUNCTION public.guard_membership_identity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- Never move historical attendance/schedules to another person or station.
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.station_id IS DISTINCT FROM OLD.station_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Membership identity cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_membership_identity BEFORE UPDATE ON public.station_memberships
FOR EACH ROW EXECUTE FUNCTION public.guard_membership_identity();

-- Phase 10 allowed unrestricted station updates. Keep operational settings only;
-- station identity, contact details, activation, and ownership remain super-admin-only.
CREATE OR REPLACE FUNCTION public.guard_station_configuration()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) AND
    (to_jsonb(NEW) - ARRAY['allowed_late_minutes', 'allowed_early_leave_minutes',
      'left_open_warning_hours', 'nfc_public_token', 'updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['allowed_late_minutes', 'allowed_early_leave_minutes',
      'left_open_warning_hours', 'nfc_public_token', 'updated_at']) THEN
    RAISE EXCEPTION 'Station configuration is managed by the platform administrator' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_station_configuration BEFORE UPDATE ON public.stations
FOR EACH ROW EXECUTE FUNCTION public.guard_station_configuration();

COMMIT;
