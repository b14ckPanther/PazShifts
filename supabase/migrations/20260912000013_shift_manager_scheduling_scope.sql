BEGIN;
-- Shift managers manage schedules, not station attendance/exception dashboards.
-- Own attendance remains available for their personal worker/NFC flow.
DROP POLICY IF EXISTS shift_managers_select_attendance ON public.attendance_records;
-- Existing schedule and availability policies retain station-scoped scheduling rights.
-- Attendance corrections, NFC rotation, tolerances, staff, and templates remain admin-only.
-- Shift managers can publish and reopen schedules, but cannot archive them.
DROP POLICY IF EXISTS schedules_update_policy ON public.schedules;
CREATE POLICY schedules_update_policy ON public.schedules FOR UPDATE TO authenticated
USING (public.is_station_admin(station_id, auth.uid()) OR
  (public.has_station_role(station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid()) AND status IN ('DRAFT', 'PUBLISHED')))
WITH CHECK (public.is_station_admin(station_id, auth.uid()) OR
  (public.has_station_role(station_id, 'SHIFT_MANAGER'::public.station_role, auth.uid()) AND status IN ('DRAFT', 'PUBLISHED')));
COMMIT;
