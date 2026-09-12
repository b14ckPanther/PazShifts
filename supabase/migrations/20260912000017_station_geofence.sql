BEGIN;
ALTER TABLE public.stations
 ADD COLUMN latitude double precision CHECK(latitude BETWEEN -90 AND 90),
 ADD COLUMN longitude double precision CHECK(longitude BETWEEN -180 AND 180),
 ADD COLUMN attendance_radius_m integer NOT NULL DEFAULT 50 CHECK(attendance_radius_m BETWEEN 30 AND 200);
-- User-supplied coordinates, matched by existing unique station code only.
UPDATE public.stations SET latitude=32.858784,longitude=35.090755 WHERE code='KURDANI';
UPDATE public.stations SET latitude=32.804492,longitude=35.075356 WHERE code='KIRYAT-ATA';
-- Existing unconfigured stations fail closed for NFC; new stations require coordinates.
CREATE FUNCTION public.require_station_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN RAISE EXCEPTION 'Station coordinates are required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER station_location_required BEFORE INSERT ON public.stations FOR EACH ROW EXECUTE FUNCTION public.require_station_location();
CREATE FUNCTION public.set_station_location(p_station_id uuid,p_latitude double precision,p_longitude double precision,p_radius integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active)
 OR NOT (public.is_platform_admin(auth.uid()) OR public.is_station_admin(p_station_id,auth.uid())) THEN
 RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF p_latitude IS NULL OR p_longitude IS NULL OR p_radius IS NULL OR NOT(p_latitude BETWEEN -90 AND 90) OR NOT(p_longitude BETWEEN -180 AND 180) OR NOT(p_radius BETWEEN 30 AND 200) THEN RAISE EXCEPTION 'Invalid location'; END IF;
 UPDATE public.stations SET latitude=p_latitude,longitude=p_longitude,attendance_radius_m=p_radius,updated_at=now() WHERE id=p_station_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Station not found'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_station_location(uuid,double precision,double precision,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_station_location(uuid,double precision,double precision,integer) TO authenticated;
CREATE FUNCTION public.check_station_location(s public.stations,lat double precision,lon double precision,accuracy double precision,captured timestamptz)
RETURNS text LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE distance_m double precision;
BEGIN
 IF s.latitude IS NULL OR s.longitude IS NULL THEN RETURN 'LOCATION_NOT_CONFIGURED'; END IF;
 IF lat IS NULL OR lon IS NULL OR accuracy IS NULL OR captured IS NULL
 OR NOT(lat BETWEEN -90 AND 90) OR NOT(lon BETWEEN -180 AND 180)
 OR NOT(accuracy BETWEEN 0 AND 100000) THEN RETURN 'LOCATION_REQUIRED'; END IF;
 IF captured < clock_timestamp()-interval '60 seconds' OR captured > clock_timestamp()+interval '10 seconds' THEN RETURN 'LOCATION_STALE'; END IF;
 -- Accuracy must be at least as precise as the configured radius; never widen the fence.
 IF accuracy > s.attendance_radius_m THEN RETURN 'LOCATION_INACCURATE'; END IF;
 distance_m := 6371000 * 2 * asin(sqrt(least(1.0,
 power(sin(radians(lat-s.latitude)/2),2)+cos(radians(s.latitude))*cos(radians(lat))*power(sin(radians(lon-s.longitude)/2),2))));
 IF distance_m > s.attendance_radius_m THEN RETURN 'OUTSIDE_STATION'; END IF;
 RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.check_station_location(public.stations,double precision,double precision,double precision,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.process_nfc_scan(p_token text,p_scan_id uuid,p_scanned_at timestamptz) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT jsonb_build_object('success',false,'code','LOCATION_REQUIRED'); $$;
-- Remove the old RPC: it must not remain a bypass for direct clients/old deployments.
DROP FUNCTION public.process_nfc_scan(text,uuid,timestamptz,text);
CREATE OR REPLACE FUNCTION public.process_nfc_scan(p_token text, p_scan_id uuid, p_scanned_at timestamptz, p_decision text, p_latitude double precision, p_longitude double precision, p_accuracy double precision, p_location_at timestamptz)
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
  v_geo text;
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
      v_geo := public.check_station_location(v_station, p_latitude, p_longitude, p_accuracy, p_location_at);
      IF v_geo IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'code', v_geo); END IF;

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

      v_geo := public.check_station_location(v_station, p_latitude, p_longitude, p_accuracy, p_location_at);
      IF v_geo IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'code', v_geo); END IF;

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


REVOKE ALL ON FUNCTION public.process_nfc_scan(text,uuid,timestamptz,text,double precision,double precision,double precision,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.process_nfc_scan(text,uuid,timestamptz,text,double precision,double precision,double precision,timestamptz) TO authenticated;
COMMIT;
