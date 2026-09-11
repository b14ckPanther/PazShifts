"""Regression checks in a disposable local PostgreSQL cluster. Never connects to Supabase.
Run: python3 tests/staff-permissions-db.py (PostgreSQL binaries must be on PATH).
"""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def command(*args, **kwargs):
    result = subprocess.run(args, text=True, capture_output=True, **kwargs)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout

with tempfile.TemporaryDirectory(prefix='ys-staff-db-') as temporary:
    base = Path(temporary)
    command('initdb', '-D', str(base / 'data'), '-A', 'trust', '-U', 'postgres')
    # Unix socket only; no network listener, no shared developer database.
    command('pg_ctl', '-D', str(base / 'data'), '-l', str(base / 'postgres.log'),
            '-o', f"-k {base} -c listen_addresses=''", '-w', 'start')
    def sql(source, fails=False):
        result = subprocess.run(['psql', '-X', '-h', str(base), '-U', 'postgres',
                                 '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
                                input=source, text=True, capture_output=True)
        if fails:
            assert result.returncode != 0, 'Expected denial: ' + source
        else:
            assert result.returncode == 0, result.stderr
        return result.stdout
    try:
        sql("""
        CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, phone text, raw_user_meta_data jsonb DEFAULT '{}');
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
          $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        GRANT USAGE ON SCHEMA auth TO authenticated, anon;
        """)
        for migration in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
            sql(migration.read_text())
        # Supabase's default table privileges; local PostgreSQL has none by default.
        sql('GRANT SELECT, INSERT, UPDATE ON public.stations TO authenticated;')
        user = lambda n: f'00000000-0000-0000-0000-{n:012d}'
        station = user(101)
        other = user(102)
        sql("INSERT INTO auth.users(id,email) VALUES " + ','.join(
            f"('{user(n)}','fixture{n}@example.com')" for n in range(1,8)) + ';')
        sql(f"""INSERT INTO public.platform_admins(user_id) VALUES ('{user(1)}');
        INSERT INTO public.stations(id,code,name) VALUES ('{station}','TEST-A','Test A'),('{other}','TEST-B','Test B');
        INSERT INTO public.station_memberships(id,station_id,user_id,role) VALUES
        ('{user(201)}','{station}','{user(2)}','ADMIN'),
        ('{user(202)}','{station}','{user(3)}','ADMIN'),
        ('{user(203)}','{station}','{user(4)}','WORKER'),
        ('{user(204)}','{station}','{user(5)}','SHIFT_MANAGER'),
        ('{user(205)}','{other}','{user(6)}','WORKER');""")
        def attempt(actor, statement, fails=False):
            return sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{user(actor)}',true); {statement}; ROLLBACK;", fails)
        def update(actor, target, changes, affected):
            output = attempt(actor, f"UPDATE public.station_memberships SET {changes} WHERE user_id='{user(target)}'")
            assert f'UPDATE {affected}' in output, output
        update(2,4,"role='SHIFT_MANAGER'",1)
        update(2,5,"role='WORKER'",1)
        update(2,2,"status='INACTIVE'",0)
        update(2,3,"role='WORKER'",0)
        update(2,3,"status='SUSPENDED'",0)
        update(2,6,"role='SHIFT_MANAGER'",0)
        update(4,5,"role='WORKER'",0)
        attempt(2,f"UPDATE public.station_memberships SET role='ADMIN' WHERE user_id='{user(4)}'",True)
        attempt(2,f"INSERT INTO public.station_memberships(station_id,user_id,role) VALUES ('{station}','{user(7)}','ADMIN')",True)
        attempt(2,f"INSERT INTO public.station_memberships(station_id,user_id,role) VALUES ('{station}','{user(7)}','WORKER')")
        attempt(2,f"DELETE FROM public.station_memberships WHERE user_id='{user(2)}'",True)
        attempt(2,f"UPDATE public.station_memberships SET station_id='{other}' WHERE user_id='{user(4)}'",True)
        attempt(2,f"UPDATE public.stations SET name='Hijacked' WHERE id='{station}'",True)
        attempt(2,"INSERT INTO public.stations(code,name) VALUES ('DENIED','Denied')",True)
        attempt(2,f"UPDATE public.stations SET allowed_late_minutes=5 WHERE id='{station}'")
        update(1,4,"role='ADMIN'",1)
        update(1,3,"role='WORKER'",1)
        attempt(1,f"UPDATE public.stations SET name='Allowed' WHERE id='{station}'")
        # Real FK into membership: deactivation preserves attendance/history.
        sql(f"""INSERT INTO public.attendance_records(station_id,user_id,station_membership_id,clock_in_at,clock_out_at,status)
            VALUES ('{station}','{user(4)}','{user(203)}',now()-interval '1 hour',now(),'COMPLETED');""")
        update(2,4,"status='INACTIVE'",1)
        assert sql('SELECT count(*) FROM public.attendance_records;').strip() == '1'
        print('PASS: all migrations; role changes; protected/self/cross-station/worker denial; admin creation denial; super-admin rights; station configuration; history preservation')
    finally:
        command('pg_ctl', '-D', str(base / 'data'), '-m', 'immediate', '-w', 'stop')
