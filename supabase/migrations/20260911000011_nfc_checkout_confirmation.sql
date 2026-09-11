BEGIN;
ALTER TABLE public.nfc_scan_receipts DROP CONSTRAINT nfc_scan_receipts_action_check;
ALTER TABLE public.nfc_scan_receipts ADD CONSTRAINT nfc_scan_receipts_action_check CHECK(action IN ('CLOCK_IN','CLOCK_OUT','CHECKOUT_PENDING','CANCELLED'));
CREATE FUNCTION public.process_nfc_scan(p_token text, p_scan_id uuid, p_scanned_at timestamptz, p_decision text)
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

CREATE OR REPLACE FUNCTION public.process_nfc_scan(p_token text, p_scan_id uuid, p_scanned_at timestamptz)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT public.process_nfc_scan(p_token, p_scan_id, p_scanned_at, 'scan'); $$;
REVOKE ALL ON FUNCTION public.process_nfc_scan(text,uuid,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_nfc_scan(text,uuid,timestamptz,text) TO authenticated;
COMMIT;
