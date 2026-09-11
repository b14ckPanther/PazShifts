-- Station administrators may record and correct attendance, including their own.
-- Preserve every manual edit, validate scope in the database, serialize with NFC scans.
CREATE TABLE public.attendance_manual_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 attendance_record_id uuid NOT NULL REFERENCES public.attendance_records(id),
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 reason text NOT NULL,
 before_record jsonb,
 after_record jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_manual_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.attendance_manual_audit TO authenticated;
CREATE POLICY admins_read_manual_audit ON public.attendance_manual_audit FOR SELECT TO authenticated
 USING (public.is_platform_admin(auth.uid()) OR public.is_station_admin(station_id, auth.uid()));

CREATE FUNCTION public.save_manual_attendance(
 p_station_id uuid, p_membership_id uuid, p_record_id uuid,
 p_clock_in timestamp, p_clock_out timestamp, p_reason text, p_expected_updated_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_member public.station_memberships;
 v_old public.attendance_records;
 v_new public.attendance_records;
 v_zone text;
 v_in timestamptz;
 v_out timestamptz;
BEGIN
 IF v_actor IS NULL OR NOT (public.is_platform_admin(v_actor) OR public.is_station_admin(p_station_id, v_actor)) THEN
  RAISE EXCEPTION 'MANUAL_FORBIDDEN';
 END IF;
 IF nullif(trim(p_reason), '') IS NULL OR length(p_reason) > 1000 THEN RAISE EXCEPTION 'MANUAL_REASON'; END IF;
 SELECT * INTO v_member FROM public.station_memberships WHERE id = p_membership_id AND station_id = p_station_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN'; END IF;
 SELECT timezone INTO v_zone FROM public.stations WHERE id = p_station_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_member.user_id::text, 0));
 IF p_record_id IS NOT NULL THEN
  SELECT * INTO v_old FROM public.attendance_records WHERE id = p_record_id AND station_id = p_station_id AND station_membership_id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN'; END IF;
  IF p_expected_updated_at IS NULL OR v_old.updated_at != p_expected_updated_at THEN RAISE EXCEPTION 'MANUAL_STALE'; END IF;
 ELSIF v_member.status != 'ACTIVE' THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN';
 END IF;
 v_in := p_clock_in AT TIME ZONE v_zone;
 v_out := p_clock_out AT TIME ZONE v_zone;
 IF v_in IS NULL OR NOT isfinite(v_in) OR v_in > now() OR
    (v_out IS NOT NULL AND (NOT isfinite(v_out) OR v_out < v_in OR v_out > now())) THEN
  RAISE EXCEPTION 'MANUAL_TIME';
 END IF;
 -- Reject local timestamps inside a daylight-saving gap instead of silently shifting them.
 IF v_in AT TIME ZONE v_zone != p_clock_in OR (v_out IS NOT NULL AND v_out AT TIME ZONE v_zone != p_clock_out) THEN RAISE EXCEPTION 'MANUAL_TIME'; END IF;
 IF EXISTS (SELECT 1 FROM public.attendance_records r WHERE r.user_id = v_member.user_id
   AND (p_record_id IS NULL OR r.id != p_record_id)
   AND tstzrange(r.clock_in_at, coalesce(r.clock_out_at, 'infinity'), '[)') && tstzrange(v_in, coalesce(v_out, 'infinity'), '[)')) THEN
  RAISE EXCEPTION 'MANUAL_OVERLAP';
 END IF;
 IF p_record_id IS NULL THEN
  INSERT INTO public.attendance_records(station_id, station_membership_id, user_id, clock_in_at, clock_out_at, status, clock_in_source, clock_out_source, corrected_by, correction_reason, corrected_at)
  VALUES (p_station_id,p_membership_id,v_member.user_id,v_in,v_out,
    CASE WHEN v_out IS NULL THEN 'ACTIVE'::public.attendance_status ELSE 'COMPLETED'::public.attendance_status END,
    'MANUAL_ADMIN',CASE WHEN v_out IS NULL THEN NULL ELSE 'MANUAL_ADMIN'::public.attendance_source END,v_actor,trim(p_reason),now()) RETURNING * INTO v_new;
 ELSE
  UPDATE public.attendance_records SET clock_in_at=v_in, clock_out_at=v_out,
   status=CASE WHEN v_out IS NULL THEN 'ACTIVE'::public.attendance_status ELSE 'COMPLETED'::public.attendance_status END,
   clock_in_source=CASE WHEN v_in IS DISTINCT FROM v_old.clock_in_at THEN 'MANUAL_ADMIN'::public.attendance_source ELSE clock_in_source END,
   clock_out_source=CASE WHEN v_out IS NULL THEN NULL WHEN v_out IS DISTINCT FROM v_old.clock_out_at THEN 'MANUAL_ADMIN'::public.attendance_source ELSE clock_out_source END,
   corrected_by=v_actor, correction_reason=trim(p_reason), corrected_at=now(), updated_at=now()
  WHERE id=p_record_id RETURNING * INTO v_new;
 END IF;
 INSERT INTO public.attendance_manual_audit(station_id, attendance_record_id, actor_id, reason, before_record, after_record)
 VALUES(p_station_id,v_new.id,v_actor,trim(p_reason),CASE WHEN p_record_id IS NULL THEN NULL ELSE to_jsonb(v_old) END,to_jsonb(v_new));
 RETURN to_jsonb(v_new);
END; $$;
REVOKE ALL ON FUNCTION public.save_manual_attendance(uuid,uuid,uuid,timestamp,timestamp,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_manual_attendance(uuid,uuid,uuid,timestamp,timestamp,text,timestamptz) TO authenticated;
