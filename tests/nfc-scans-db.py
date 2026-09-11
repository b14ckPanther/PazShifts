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
        CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        GRANT USAGE ON SCHEMA auth TO authenticated, anon;""")
        for migration in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
            sql(migration.read_text())
        uid = lambda n: f'00000000-0000-0000-0000-{n:012d}'
        sql(f"""INSERT INTO auth.users(id,email) VALUES ('{uid(1)}','worker@example.com'),('{uid(2)}','other@example.com');
        INSERT INTO public.stations(id,code,name,nfc_public_token) VALUES ('{uid(101)}','NFC-A','Test A','token-a'),('{uid(102)}','NFC-B','Test B','token-b');
        INSERT INTO public.station_memberships(id,station_id,user_id,role) VALUES ('{uid(201)}','{uid(101)}','{uid(1)}','WORKER'),('{uid(202)}','{uid(102)}','{uid(1)}','WORKER');
        GRANT SELECT,INSERT,UPDATE ON public.attendance_records TO authenticated;""")
        def scan(scan_id=None, token='token-a', actor=1, timestamp='clock_timestamp()'):
            identity = str(scan_id or uuid.uuid4())
            output = sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{uid(actor)}',true); SELECT public.process_nfc_scan('{token}','{identity}',{timestamp}); COMMIT;")
            return json.loads(next(line for line in output.splitlines() if line.startswith('{')))
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
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: scan(checkout_id), range(6)))
        assert all(r['record']['status'] == 'COMPLETED' for r in results)
        assert sum(not r['replayed'] for r in results) == 1
        assert sql('SELECT count(*) FROM public.attendance_records;').strip() == '1'
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
        sql(f"UPDATE public.station_memberships SET status='INACTIVE' WHERE id='{uid(201)}';")
        assert scan(first_id)['code'] == 'NO_MEMBERSHIP'
        print('PASS: atomic in/out; persistent retry receipts; concurrent same/different IDs; duplicate window; old receipt; expiry; other station; inactive/unassigned users; direct-write and anonymous denial')
    finally:
        command('pg_ctl', '-D', str(base / 'data'), '-m', 'immediate', '-w', 'stop')
