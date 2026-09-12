BEGIN;
-- Preserve historical identifiers/audit evidence even when a mistaken row is removed.
ALTER TABLE public.attendance_manual_audit DROP CONSTRAINT attendance_manual_audit_attendance_record_id_fkey;
ALTER TABLE public.nfc_scan_receipts DROP CONSTRAINT nfc_scan_receipts_attendance_id_fkey;
CREATE TABLE public.attendance_removals (
 attendance_record_id uuid PRIMARY KEY,
 station_id uuid NOT NULL REFERENCES public.stations(id),
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 reason text NOT NULL,
 before_record jsonb NOT NULL,
 removed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.attendance_removals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.attendance_removals TO authenticated;
CREATE POLICY admins_read_attendance_removals ON public.attendance_removals FOR SELECT TO authenticated
 USING(public.is_platform_admin(auth.uid()) OR public.is_station_admin(station_id,auth.uid()));
CREATE FUNCTION public.manage_attendance_record(p_station_id uuid,p_record_id uuid,p_action text,p_reason text,p_expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_old public.attendance_records;
 v_new public.attendance_records;
BEGIN
 IF v_actor IS NULL OR NOT (public.is_platform_admin(v_actor) OR public.is_station_admin(p_station_id,v_actor))
 OR NOT EXISTS(SELECT 1 FROM public.stations WHERE id=p_station_id AND is_active) THEN RAISE EXCEPTION 'MANUAL_FORBIDDEN'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('CLOSE','DELETE') THEN RAISE EXCEPTION 'MANUAL_ACTION'; END IF;
 IF nullif(trim(p_reason),'') IS NULL OR length(p_reason)>1000 THEN RAISE EXCEPTION 'MANUAL_REASON'; END IF;
 SELECT * INTO v_old FROM public.attendance_records WHERE id=p_record_id AND station_id=p_station_id;
 IF NOT FOUND THEN
  IF p_action='DELETE' AND EXISTS(SELECT 1 FROM public.attendance_removals WHERE attendance_record_id=p_record_id AND station_id=p_station_id) THEN RETURN jsonb_build_object('success',true); END IF;
  RAISE EXCEPTION 'MANUAL_STALE';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_old.user_id::text,0));
 SELECT * INTO v_old FROM public.attendance_records WHERE id=p_record_id AND station_id=p_station_id FOR UPDATE;
 IF NOT FOUND OR p_expected_updated_at IS NULL OR v_old.updated_at<>p_expected_updated_at THEN RAISE EXCEPTION 'MANUAL_STALE'; END IF;
 IF p_action='DELETE' THEN
  INSERT INTO public.attendance_removals(attendance_record_id,station_id,actor_id,reason,before_record)
   VALUES(v_old.id,p_station_id,v_actor,trim(p_reason),to_jsonb(v_old));
  DELETE FROM public.attendance_records WHERE id=v_old.id;
 ELSE
  IF v_old.status<>'ACTIVE' THEN RAISE EXCEPTION 'MANUAL_STALE'; END IF;
  UPDATE public.attendance_records SET status='COMPLETED',clock_out_at=greatest(clock_timestamp(),clock_in_at),
   clock_out_source='MANUAL_ADMIN',corrected_by=v_actor,correction_reason=trim(p_reason),corrected_at=clock_timestamp(),updated_at=clock_timestamp()
   WHERE id=v_old.id RETURNING * INTO v_new;
  INSERT INTO public.attendance_manual_audit(station_id,attendance_record_id,actor_id,reason,before_record,after_record)
   VALUES(p_station_id,v_old.id,v_actor,trim(p_reason),to_jsonb(v_old),to_jsonb(v_new));
 END IF;
 RETURN jsonb_build_object('success',true);
END; $$;
REVOKE ALL ON FUNCTION public.manage_attendance_record(uuid,uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_attendance_record(uuid,uuid,text,text,timestamptz) TO authenticated;

-- Retain receipts as replay tombstones; deleted records must never be recreated by an old scan.
CREATE OR REPLACE FUNCTION public.process_nfc_scan(p_token text, p_scan_id uuid, p_scanned_at timestamptz, p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_station public.stations%ROWTYPE;
  v_member public.station_memberships%ROWTYPE;
  v_record public.attendance_records%ROWTYPE;
  v_receipt public.nfc_scan_receipts%ROWTYPE;
  v_now timestamptz;
  v_shift uuid;
  v_action text;
  v_changed boolean := false;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED'); END IF;
  IF p_scan_id IS NULL THEN RETURN jsonb_build_object('success', false, 'code', 'INVALID_SCAN'); END IF;
  IF p_decision NOT IN ('scan', 'confirm', 'cancel') OR p_decision IS NULL THEN RETURN jsonb_build_object('success', false, 'code', 'INVALID_SCAN'); END IF;
  -- Serialize every scan for this worker, including concurrent visits to other stations.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  v_now := clock_timestamp();
  SELECT * INTO v_station FROM public.stations WHERE nfc_public_token = p_token AND is_active FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'INVALID_TAG'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_MEMBERSHIP');
  END IF;
  SELECT * INTO v_member FROM public.station_memberships
    WHERE station_id = v_station.id AND user_id = v_user AND status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'NO_MEMBERSHIP'); END IF;

  SELECT * INTO v_receipt FROM public.nfc_scan_receipts WHERE user_id = v_user AND scan_id = p_scan_id;
  IF FOUND THEN
    IF v_receipt.station_id <> v_station.id THEN RETURN jsonb_build_object('success', false, 'code', 'INVALID_SCAN'); END IF;
    SELECT * INTO v_record FROM public.attendance_records WHERE id = v_receipt.attendance_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'STALE_CHECKOUT'); END IF;
    IF v_receipt.action = 'CHECKOUT_PENDING' THEN
      IF v_record.status <> 'ACTIVE' THEN RETURN jsonb_build_object('success', false, 'code', 'STALE_CHECKOUT'); END IF;
      IF v_receipt.created_at < v_now - interval '15 minutes' THEN RETURN jsonb_build_object('success', false, 'code', 'EXPIRED_SCAN'); END IF;
      IF p_decision = 'cancel' THEN
        UPDATE public.nfc_scan_receipts SET action = 'CANCELLED' WHERE user_id = v_user AND scan_id = p_scan_id;
        v_receipt.action := 'CANCELLED';
        v_changed := true;
      ELSIF p_decision = 'confirm' THEN
        IF v_record.status <> 'ACTIVE' THEN RETURN jsonb_build_object('success', false, 'code', 'STALE_CHECKOUT'); END IF;
        UPDATE public.attendance_records SET status = 'COMPLETED', clock_out_at = greatest(v_now, clock_in_at), clock_out_source = 'NFC', updated_at = v_now WHERE id = v_record.id RETURNING * INTO v_record;
        UPDATE public.nfc_scan_receipts SET action = 'CLOCK_OUT', applied_at = v_now WHERE user_id = v_user AND scan_id = p_scan_id;
        v_receipt.action := 'CLOCK_OUT';
        v_changed := true;
      END IF;
    END IF;
    RETURN jsonb_build_object('success', true, 'action', v_receipt.action, 'record', to_jsonb(v_record), 'replayed', NOT v_changed);
  END IF;
  IF p_decision <> 'scan' THEN RETURN jsonb_build_object('success', false, 'code', 'INVALID_SCAN'); END IF;
  -- A tab left unopened/unprocessed for a long time must not start/end work later.
  IF p_scanned_at IS NULL OR p_scanned_at < v_now - interval '15 minutes' OR p_scanned_at > v_now + interval '30 seconds' THEN
    RETURN jsonb_build_object('success', false, 'code', 'EXPIRED_SCAN');
  END IF;

  SELECT * INTO v_record FROM public.attendance_records WHERE user_id = v_user AND status = 'ACTIVE' FOR UPDATE;
  IF FOUND AND v_record.station_id <> v_station.id THEN
    RETURN jsonb_build_object('success', false, 'code', 'OTHER_STATION');
  END IF;
  SELECT * INTO v_receipt FROM public.nfc_scan_receipts
    WHERE action IN ('CLOCK_IN', 'CLOCK_OUT') AND user_id = v_user AND station_id = v_station.id AND applied_at > v_now - interval '10 seconds'
      AND EXISTS (SELECT 1 FROM public.attendance_records r WHERE r.id = nfc_scan_receipts.attendance_id)
    ORDER BY applied_at DESC LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.nfc_scan_receipts(user_id, scan_id, station_id, attendance_id, action, applied_at)
      VALUES(v_user, p_scan_id, v_station.id, v_receipt.attendance_id, v_receipt.action, v_receipt.applied_at);
    SELECT * INTO v_record FROM public.attendance_records WHERE id = v_receipt.attendance_id;
    RETURN jsonb_build_object('success', true, 'action', v_receipt.action, 'record', to_jsonb(v_record), 'replayed', true, 'duplicate', true);
  END IF;

  IF v_record.id IS NOT NULL THEN
    v_action := 'CHECKOUT_PENDING';
  ELSE
    SELECT s.id INTO v_shift FROM public.shift_assignments a
      JOIN public.scheduled_shifts s ON s.id = a.scheduled_shift_id
      JOIN public.schedules schedule ON schedule.id = s.schedule_id AND schedule.status = 'PUBLISHED'
      WHERE a.station_membership_id = v_member.id AND a.station_id = v_station.id
        AND s.station_id = v_station.id AND a.status IN ('ASSIGNED', 'CONFIRMED')
        AND v_now BETWEEN s.start_at - interval '150 minutes' AND s.end_at + interval '1 hour'
      ORDER BY abs(extract(epoch FROM s.start_at - v_now)) LIMIT 1;
    INSERT INTO public.attendance_records(station_id, station_membership_id, user_id, scheduled_shift_id, clock_in_at, status, clock_in_source)
      VALUES(v_station.id, v_member.id, v_user, v_shift, v_now, 'ACTIVE', 'NFC') RETURNING * INTO v_record;
    v_action := 'CLOCK_IN';
  END IF;
  INSERT INTO public.nfc_scan_receipts(user_id, scan_id, station_id, attendance_id, action, applied_at)
    VALUES(v_user, p_scan_id, v_station.id, v_record.id, v_action, v_now);
  RETURN jsonb_build_object('success', true, 'action', v_action, 'record', to_jsonb(v_record), 'replayed', false);
END;
$$;

COMMIT;
