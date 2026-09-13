BEGIN;
-- Native confirmation uses the existing attendance engine under its existing worker lock.
CREATE FUNCTION public.process_native_nfc_scan(
 p_token text,p_scan_id uuid,p_scanned_at timestamptz,p_expected_action text,p_expected_record uuid,
 p_latitude double precision,p_longitude double precision,p_accuracy double precision,p_location_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid(); active_id uuid; receipt public.nfc_scan_receipts; result jsonb;
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM auth.sessions sess WHERE sess.id::text=auth.jwt()->>'session_id' AND sess.user_id=u AND (sess.not_after IS NULL OR sess.not_after>now())) THEN RETURN jsonb_build_object('success',false,'code','SESSION_EXPIRED'); END IF;
 IF p_scan_id IS NULL OR p_token IS NULL OR length(p_token)>256 OR p_expected_action IS NULL OR p_expected_action NOT IN ('CLOCK_IN','CLOCK_OUT')
 OR (p_expected_action='CLOCK_OUT' AND p_expected_record IS NULL) OR (p_expected_action='CLOCK_IN' AND p_expected_record IS NOT NULL) THEN
 RETURN jsonb_build_object('success',false,'code','INVALID_SCAN'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 -- Existing engine rechecks token, identity, membership, expiry and geofence; never bypass it.
 SELECT * INTO receipt FROM public.nfc_scan_receipts WHERE user_id=u AND scan_id=p_scan_id;
 IF FOUND THEN
   IF receipt.action='CHECKOUT_PENDING' AND (p_expected_action<>'CLOCK_OUT' OR p_expected_record<>receipt.attendance_id) THEN
     RETURN jsonb_build_object('success',false,'code','STATE_CHANGED');
   END IF;
   RETURN public.process_nfc_scan(p_token,p_scan_id,p_scanned_at,CASE WHEN receipt.action='CHECKOUT_PENDING' THEN 'confirm' ELSE 'scan' END,p_latitude,p_longitude,p_accuracy,p_location_at);
 END IF;
 -- Check access before exposing even whether an active record exists.
 IF NOT EXISTS(SELECT 1 FROM public.stations s JOIN public.station_memberships m ON m.station_id=s.id JOIN public.profiles p ON p.id=m.user_id
   WHERE s.nfc_public_token=p_token AND s.is_active AND m.user_id=u AND m.status='ACTIVE' AND p.is_active) THEN
   RETURN jsonb_build_object('success',false,'code','NO_MEMBERSHIP');
 END IF;
 SELECT id INTO active_id FROM public.attendance_records WHERE user_id=u AND status='ACTIVE' FOR UPDATE;
 IF (p_expected_action='CLOCK_IN' AND active_id IS NOT NULL) OR (p_expected_action='CLOCK_OUT' AND active_id IS DISTINCT FROM p_expected_record) THEN
   RETURN jsonb_build_object('success',false,'code','STATE_CHANGED');
 END IF;
 result:=public.process_nfc_scan(p_token,p_scan_id,p_scanned_at,'scan',p_latitude,p_longitude,p_accuracy,p_location_at);
 IF result->>'action'='CHECKOUT_PENDING' THEN
   result:=public.process_nfc_scan(p_token,p_scan_id,p_scanned_at,'confirm',p_latitude,p_longitude,p_accuracy,p_location_at);
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.process_native_nfc_scan(text,uuid,timestamptz,text,uuid,double precision,double precision,double precision,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.process_native_nfc_scan(text,uuid,timestamptz,text,uuid,double precision,double precision,double precision,timestamptz) TO authenticated;
-- Read-only receipt recovery after a lost response. Never creates a scan or requires another location fix.
CREATE FUNCTION public.read_native_nfc_receipt(p_token text,p_scan_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE receipt public.nfc_scan_receipts; record public.attendance_records;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM auth.sessions sess WHERE sess.id::text=auth.jwt()->>'session_id' AND sess.user_id=auth.uid() AND (sess.not_after IS NULL OR sess.not_after>now())) OR NOT EXISTS(SELECT 1 FROM public.stations s JOIN public.station_memberships m ON m.station_id=s.id JOIN public.profiles p ON p.id=m.user_id
 WHERE s.nfc_public_token=p_token AND s.is_active AND m.user_id=auth.uid() AND m.status='ACTIVE' AND p.is_active) THEN RAISE EXCEPTION 'Access unavailable' USING ERRCODE='42501'; END IF;
 SELECT r.* INTO receipt FROM public.nfc_scan_receipts r JOIN public.stations s ON s.id=r.station_id WHERE r.user_id=auth.uid() AND r.scan_id=p_scan_id AND s.nfc_public_token=p_token;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO record FROM public.attendance_records WHERE id=receipt.attendance_id AND user_id=auth.uid();
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'code','STALE_CHECKOUT'); END IF;
 RETURN jsonb_build_object('success',true,'action',receipt.action,'record',to_jsonb(record),'replayed',true);
END $$;
REVOKE ALL ON FUNCTION public.read_native_nfc_receipt(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_native_nfc_receipt(text,uuid) TO authenticated;
COMMIT;
