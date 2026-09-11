-- One authenticated NFC-link visit = one atomic attendance operation.
-- Retry IDs survive refresh/back/network retries; rapid repeated scans are coalesced.
BEGIN;
CREATE TABLE public.nfc_scan_receipts (
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  scan_id uuid NOT NULL,
  station_id uuid NOT NULL REFERENCES public.stations(id),
  attendance_id uuid NOT NULL REFERENCES public.attendance_records(id),
  action text NOT NULL CHECK (action IN ('CLOCK_IN', 'CLOCK_OUT')),
  applied_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, scan_id)
);
CREATE INDEX nfc_scan_receipts_recent ON public.nfc_scan_receipts(user_id, applied_at DESC);
ALTER TABLE public.nfc_scan_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nfc_scan_receipts FROM anon, authenticated;

-- Workers must use the token-scoped RPC. Auditable admin correction policies remain.
DROP POLICY IF EXISTS workers_insert_own_attendance ON public.attendance_records;
DROP POLICY IF EXISTS workers_update_own_attendance ON public.attendance_records;

CREATE FUNCTION public.process_nfc_scan(p_token text, p_scan_id uuid, p_scanned_at timestamptz)
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
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED'); END IF;
  IF p_scan_id IS NULL THEN RETURN jsonb_build_object('success', false, 'code', 'INVALID_SCAN'); END IF;
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
    SELECT * INTO v_record FROM public.attendance_records WHERE id = v_receipt.attendance_id;
    RETURN jsonb_build_object('success', true, 'action', v_receipt.action, 'record', to_jsonb(v_record), 'replayed', true);
  END IF;
  -- A tab left unopened/unprocessed for a long time must not start/end work later.
  IF p_scanned_at IS NULL OR p_scanned_at < v_now - interval '15 minutes' OR p_scanned_at > v_now + interval '30 seconds' THEN
    RETURN jsonb_build_object('success', false, 'code', 'EXPIRED_SCAN');
  END IF;

  SELECT * INTO v_record FROM public.attendance_records WHERE user_id = v_user AND status = 'ACTIVE' FOR UPDATE;
  IF FOUND AND v_record.station_id <> v_station.id THEN
    RETURN jsonb_build_object('success', false, 'code', 'OTHER_STATION');
  END IF;
  SELECT * INTO v_receipt FROM public.nfc_scan_receipts
    WHERE user_id = v_user AND station_id = v_station.id AND applied_at > v_now - interval '10 seconds'
    ORDER BY applied_at DESC LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.nfc_scan_receipts(user_id, scan_id, station_id, attendance_id, action, applied_at)
      VALUES(v_user, p_scan_id, v_station.id, v_receipt.attendance_id, v_receipt.action, v_receipt.applied_at);
    SELECT * INTO v_record FROM public.attendance_records WHERE id = v_receipt.attendance_id;
    RETURN jsonb_build_object('success', true, 'action', v_receipt.action, 'record', to_jsonb(v_record), 'replayed', true, 'duplicate', true);
  END IF;

  IF v_record.id IS NOT NULL THEN
    UPDATE public.attendance_records SET status = 'COMPLETED', clock_out_at = greatest(v_now, clock_in_at),
      clock_out_source = 'NFC', updated_at = v_now WHERE id = v_record.id RETURNING * INTO v_record;
    v_action := 'CLOCK_OUT';
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
REVOKE ALL ON FUNCTION public.process_nfc_scan(text, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_nfc_scan(text, uuid, timestamptz) TO authenticated;
COMMIT;
