"""Atomic NFC integration tests. Disposable local PostgreSQL only; no physical tag claim.
Run: python3 tests/nfc-scans-db.py (PostgreSQL binaries on PATH).
"""
from pathlib import Path
import subprocess
import tempfile
import uuid
import json
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
def command(*args):
    result = subprocess.run(args, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return result.stdout

with tempfile.TemporaryDirectory(prefix='ys-nfc-db-') as temporary:
    base = Path(temporary)
    command('initdb', '-D', str(base / 'data'), '-A', 'trust', '-U', 'postgres')
    command('pg_ctl', '-D', str(base / 'data'), '-l', str(base / 'postgres.log'),
            '-o', f"-k {base} -c listen_addresses=''", '-w', 'start')
    def sql(source, fails=False):
        result = subprocess.run(['psql', '-X', '-h', str(base), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input=source, text=True, capture_output=True)
        assert (result.returncode != 0) if fails else (result.returncode == 0), result.stderr or source
        return result.stdout
    try:
        sql("""CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, phone text, raw_user_meta_data jsonb DEFAULT '{}');
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
        CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('session_id',coalesce(nullif(current_setting('request.jwt.claim.session_id',true),''),auth.uid()::text)) $$;
        GRANT USAGE ON SCHEMA auth TO authenticated, anon;""")
        for migration in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
            sql(migration.read_text())
        sql("ALTER TABLE public.stations ALTER COLUMN latitude SET DEFAULT 32.858784, ALTER COLUMN longitude SET DEFAULT 35.090755;")
        sql('GRANT SELECT,INSERT,UPDATE,DELETE ON public.availability_weeks,public.availability_entries TO authenticated;')
        sql((ROOT / 'tests/sql/atomic-availability.sql').read_text())
        print('PASS: existing atomic availability rollback/authorization SQL regressions')
        sql((ROOT / 'tests/sql/worker-notifications.sql').read_text())
        print('PASS: existing notification SQL/RLS/device/queue regressions')
        uid = lambda n: f'00000000-0000-0000-0000-{n:012d}'
        sql(f"""INSERT INTO auth.users(id,email) VALUES ('{uid(1)}','worker@example.com'),('{uid(2)}','other@example.com');
        INSERT INTO public.stations(id,code,name,nfc_public_token) VALUES ('{uid(101)}','NFC-A','Test A','token-a'),('{uid(102)}','NFC-B','Test B','token-b');
        INSERT INTO public.station_memberships(id,station_id,user_id,role) VALUES ('{uid(201)}','{uid(101)}','{uid(1)}','WORKER'),('{uid(202)}','{uid(102)}','{uid(1)}','WORKER');
        GRANT SELECT,INSERT,UPDATE ON public.attendance_records TO authenticated;""")
        def scan(scan_id=None, token='token-a', actor=1, timestamp='clock_timestamp()', decision='scan', geo='32.858784,35.090755,5,clock_timestamp()'):
            identity = str(scan_id or uuid.uuid4())
            output = sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{uid(actor)}',true); SELECT public.process_nfc_scan('{token}','{identity}',{timestamp},'{decision}',{geo}); COMMIT;")
            return json.loads(next(line for line in output.splitlines() if line.startswith('{')))
        for geo, code in [
            ('NULL,NULL,NULL,NULL','LOCATION_REQUIRED'),
            ('32.86,35.09,5,clock_timestamp()','OUTSIDE_STATION'),
            ('32.858784,35.090755,100,clock_timestamp()','LOCATION_INACCURATE'),
            ("32.858784,35.090755,5,clock_timestamp()-interval '2 minutes'",'LOCATION_STALE'),
            ("'NaN'::float,35.09,5,clock_timestamp()",'LOCATION_REQUIRED')]:
            assert scan(geo=geo)['code'] == code
        assert sql('SELECT count(*) FROM public.attendance_records;').strip() == '0'
        sql("SELECT public.process_nfc_scan('token-a',gen_random_uuid(),now(),'scan');", fails=True)
        sql(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{uid(1)}',false); SELECT public.set_station_location('{uid(101)}',0,0,200);", fails=True)
        sql("INSERT INTO public.stations(code,name,latitude,longitude) VALUES ('NO-LOCATION','Test',NULL,NULL);", fails=True)
        for offset, expected in [(0.00044, None), (0.00046, 'OUTSIDE_STATION')]:
            verdict = sql(f"SELECT coalesce(public.check_station_location(s,latitude+{offset},longitude,5,clock_timestamp()),'OK') FROM public.stations s WHERE code='NFC-A';").strip()
            assert verdict == (expected or 'OK'), verdict
        print('PASS: location missing, distant, inaccurate, stale, NaN and old RPC bypass denied')
        def cool_down():
            sql("UPDATE public.nfc_scan_receipts SET applied_at=clock_timestamp()-interval '11 seconds';")

        sql(f"""INSERT INTO public.schedules(id,station_id,week_start_date,status) VALUES ('{uid(301)}','{uid(101)}',date_trunc('week',now())::date,'DRAFT');
        INSERT INTO public.scheduled_shifts(id,schedule_id,station_id,shift_date,start_at,end_at) VALUES ('{uid(302)}','{uid(301)}','{uid(101)}',current_date,now()-interval '5 minutes',now()+interval '8 hours');
        INSERT INTO public.shift_assignments(scheduled_shift_id,station_id,station_membership_id) VALUES ('{uid(302)}','{uid(101)}','{uid(201)}');""")
        first_id = uuid.uuid4()
        first = scan(first_id)
        assert first['success'] and first['action'] == 'CLOCK_IN' and first['record']['status'] == 'ACTIVE'
        assert first['record']['scheduled_shift_id'] is None
        replay = scan(first_id)
        assert replay['replayed'] and replay['record']['id'] == first['record']['id']
        duplicate = scan()
        assert duplicate['duplicate'] and duplicate['record']['status'] == 'ACTIVE'
        # Different UUIDs and same UUIDs, including after a lost response, cannot double-toggle.
        cool_down()
        checkout_id = uuid.uuid4()
        assert scan(decision='confirm')['code'] == 'INVALID_SCAN'
        cancelled_id = uuid.uuid4()
        assert scan(cancelled_id)['action'] == 'CHECKOUT_PENDING'
        assert scan(cancelled_id, decision='cancel')['action'] == 'CANCELLED'
        assert scan(cancelled_id, decision='confirm')['record']['status'] == 'ACTIVE'
        legacy = sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{uid(1)}',true); SELECT public.process_nfc_scan('token-a',gen_random_uuid(),clock_timestamp()); COMMIT;")
        assert 'LOCATION_REQUIRED' in legacy and 'COMPLETED' not in legacy
        pending = scan(checkout_id)
        assert scan(checkout_id, decision='confirm', geo='32.86,35.09,5,clock_timestamp()')['code'] == 'OUTSIDE_STATION'
        assert pending['action'] == 'CHECKOUT_PENDING' and pending['record']['clock_out_at'] is None
        assert scan(checkout_id)['action'] == 'CHECKOUT_PENDING'
        stale_id = uuid.uuid4()
        assert scan(stale_id)['action'] == 'CHECKOUT_PENDING'
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: scan(checkout_id, decision='confirm'), range(6)))
        assert all(r['record']['status'] == 'COMPLETED' for r in results)
        assert sum(not r['replayed'] for r in results) == 1
        assert sql('SELECT count(*) FROM public.attendance_records;').strip() == '1'
        assert scan(stale_id, decision='confirm')['code'] == 'STALE_CHECKOUT'
        # Opening a historic receipt returns its current record and never starts new work.
        cool_down()
        assert scan(first_id)['record']['status'] == 'COMPLETED'
        sql(f"UPDATE public.schedules SET status='PUBLISHED' WHERE id='{uid(301)}';")
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: scan(), range(6)))
        assert all(r['record']['scheduled_shift_id'] == uid(302) for r in results)
        assert all(r['record']['status'] == 'ACTIVE' for r in results)
        assert sum(not r['replayed'] for r in results) == 1
        assert sql("SELECT count(*) FROM public.attendance_records WHERE status='ACTIVE';").strip() == '1'
        assert scan(token='token-b')['code'] == 'OTHER_STATION'
        assert scan(actor=2)['code'] == 'NO_MEMBERSHIP'
        assert scan(token='wrong-token')['code'] == 'INVALID_TAG'
        assert scan(timestamp="clock_timestamp()-interval '16 minutes'")['code'] == 'EXPIRED_SCAN'
        assert scan(timestamp="clock_timestamp()+interval '1 hour'")['code'] == 'EXPIRED_SCAN'
        # No more direct worker insert/update shortcut that bypasses the scan RPC.
        output = sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{uid(1)}',true); UPDATE public.attendance_records SET status='COMPLETED',clock_out_at=now() WHERE user_id='{uid(1)}' AND status='ACTIVE'; ROLLBACK;")
        assert 'UPDATE 0' in output
        sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{uid(1)}',true); INSERT INTO public.attendance_records(station_id,station_membership_id,user_id) VALUES ('{uid(102)}','{uid(202)}','{uid(1)}'); ROLLBACK;", fails=True)
        sql("SET ROLE anon; SELECT public.process_nfc_scan('token-a',gen_random_uuid(),now());", fails=True)
        cool_down()
        expiring_id = uuid.uuid4()
        assert scan(expiring_id)['action'] == 'CHECKOUT_PENDING'
        sql(f"UPDATE public.nfc_scan_receipts SET created_at=now()-interval '16 minutes' WHERE scan_id='{expiring_id}';")
        assert scan(expiring_id, decision='confirm')['code'] == 'EXPIRED_SCAN'
        sql(f"UPDATE auth.users SET phone='972501234567', email='updated@example.com', raw_user_meta_data='{{\"full_name\":\"Updated Worker\"}}' WHERE id='{uid(1)}';")
        assert sql(f"SELECT full_name || '|' || phone || '|' || email FROM public.profiles WHERE id='{uid(1)}';").strip() == 'Updated Worker|+972501234567|updated@example.com'
        sql(f"UPDATE public.station_memberships SET status='INACTIVE' WHERE id='{uid(201)}';")
        assert scan(first_id)['code'] == 'NO_MEMBERSHIP'
        sql(f"UPDATE public.station_memberships SET status='ACTIVE' WHERE id='{uid(201)}'; INSERT INTO auth.sessions(id,user_id) VALUES ('{uid(1)}','{uid(1)}'),('{uid(2)}','{uid(2)}');")
        def native(action='CLOCK_IN', record=None, identity=None, actor=1, geo='32.858784,35.090755,5,clock_timestamp()'):
            identity = identity or uuid.uuid4()
            record_sql = f"'{record}'" if record else 'NULL'
            output = sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{uid(actor)}',true); SELECT public.process_native_nfc_scan('token-a','{identity}',clock_timestamp(),'{action}',{record_sql},{geo}); COMMIT;")
            return json.loads(next(line for line in output.splitlines() if line.startswith('{')))
        active = sql("SELECT id FROM public.attendance_records WHERE status='ACTIVE';").strip()
        assert native()['code'] == 'STATE_CHANGED'
        assert native('CLOCK_OUT', uid(999))['code'] == 'STATE_CHANGED'
        assert native('CLOCK_OUT', active, geo='32.86,35.09,5,clock_timestamp()')['code'] == 'OUTSIDE_STATION'
        cool_down()
        native_id = uuid.uuid4()
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: native('CLOCK_OUT', active, native_id), range(6)))
        assert all(r['success'] and r['record']['status']=='COMPLETED' for r in results), results
        assert sum(not r['replayed'] for r in results)==1
        assert native('CLOCK_OUT', active, native_id)['replayed']
        recovery = sql(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{uid(1)}',false); SELECT public.read_native_nfc_receipt('token-a','{native_id}');")
        assert 'COMPLETED' in recovery
        assert native(actor=2)['code']=='NO_MEMBERSHIP'
        sql(f"DELETE FROM auth.sessions WHERE user_id='{uid(1)}';")
        assert native('CLOCK_OUT', active, native_id)['code']=='SESSION_EXPIRED'
        sql(f"INSERT INTO auth.sessions(id,user_id) VALUES ('{uid(1)}','{uid(1)}');")
        cool_down()
        assert native()['action']=='CLOCK_IN'
        assert native()['code']=='STATE_CHANGED'
        sql(f"UPDATE public.station_memberships SET status='INACTIVE' WHERE id='{uid(201)}';")
        assert native('CLOCK_OUT', active, native_id)['code']=='NO_MEMBERSHIP'
        sql(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{uid(1)}',false); SELECT public.read_native_nfc_receipt('token-a','{native_id}');", fails=True)
        sql(f"""INSERT INTO auth.users(id,email) VALUES ('{uid(3)}','left-open@example.test');
        INSERT INTO public.station_memberships(id,station_id,user_id) VALUES ('{uid(203)}','{uid(101)}','{uid(3)}');
        INSERT INTO public.attendance_records(id,station_id,station_membership_id,user_id,clock_in_at,status) VALUES ('{uid(403)}','{uid(101)}','{uid(203)}','{uid(3)}',now()-interval '13 hours','ACTIVE');
        SET ROLE service_role; SELECT public.claim_worker_notifications(); RESET ROLE;""")
        assert sql("SELECT count(*) FROM public.worker_notifications WHERE type='LEFT_OPEN';").strip()=='1'
        sql('SET ROLE service_role; SELECT public.claim_worker_notifications(); RESET ROLE;')
        assert sql("SELECT count(*) FROM public.worker_notifications WHERE type='LEFT_OPEN';").strip()=='1'
        assert sql("SELECT public.worker_notification_current(n) FROM public.worker_notifications n WHERE type='LEFT_OPEN';").strip()=='t'
        sql(f"INSERT INTO public.worker_notification_preferences(user_id,reminder_minutes) VALUES ('{uid(3)}',0);")
        assert sql("SELECT public.worker_notification_current(n) FROM public.worker_notifications n WHERE type='LEFT_OPEN';").strip()=='f'
        sql(f"UPDATE public.worker_notification_preferences SET reminder_minutes=60 WHERE user_id='{uid(3)}'; UPDATE public.attendance_records SET status='COMPLETED',clock_out_at=now() WHERE id='{uid(403)}';")
        assert sql("SELECT public.worker_notification_current(n) FROM public.worker_notifications n WHERE type='LEFT_OPEN';").strip()=='f'
        sql('SET ROLE authenticated; SELECT public.claim_worker_notifications();',fails=True)
        print('PASS: LEFT_OPEN server queue, deduplication, disabled preference, completed-record cancellation and privileged dispatch')
        print('PASS: native expected action, location denial, six concurrent confirmations, receipt recovery, revoked session, membership isolation')
        print('PASS: automatic clock-in; confirmed checkout; cancel/replay; concurrent confirmations; stale/expired denial; legacy calls cannot auto-checkout; auth-profile sync; station/membership isolation; direct-write denial')
    finally:
        command('pg_ctl', '-D', str(base / 'data'), '-m', 'immediate', '-w', 'stop')
