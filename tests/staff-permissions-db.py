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
        # Shift managers can publish/reopen schedules, but not access team attendance or settings.
        sql('GRANT SELECT, UPDATE ON public.attendance_records TO authenticated;')
        sql(f"""INSERT INTO public.attendance_records(station_id,user_id,station_membership_id,clock_in_at,clock_out_at,status)
            VALUES ('{station}','{user(5)}','{user(204)}',now()-interval '1 hour',now(),'COMPLETED');
            INSERT INTO public.schedules(id,station_id,week_start_date,status) VALUES
            ('{user(301)}','{station}','2026-09-07','DRAFT'),
            ('{user(302)}','{other}','2026-09-07','DRAFT'),
            ('{user(303)}','{station}','2026-09-14','PUBLISHED');""")
        for actor, count in [(1,2),(2,2),(5,1),(6,0)]:
            output = attempt(actor,'SELECT count(*) AS visible FROM public.attendance_records')
            assert f'\n{count}\n' in output, output
        assert 'UPDATE 0' in attempt(5, f"UPDATE public.attendance_records SET clock_out_at=now() WHERE station_id='{station}'")
        assert 'UPDATE 0' in attempt(5, f"UPDATE public.stations SET allowed_late_minutes=90 WHERE id='{station}'")
        attempt(5, f"SELECT public.rotate_station_nfc_token('{station}')", True)
        assert 'UPDATE 1' in attempt(5, f"UPDATE public.schedules SET status='PUBLISHED' WHERE id='{user(301)}'")
        assert 'UPDATE 1' in attempt(5, f"UPDATE public.schedules SET status='DRAFT' WHERE id='{user(303)}'")
        attempt(5, f"UPDATE public.schedules SET status='ARCHIVED' WHERE id='{user(303)}'", True)
        assert 'UPDATE 0' in attempt(5, f"UPDATE public.schedules SET status='PUBLISHED' WHERE id='{user(302)}'")
        attempt(5, f"INSERT INTO public.shift_templates(station_id,name,start_time,end_time) VALUES ('{station}','Denied','09:00','17:00')", True)
        update(2,4,"status='INACTIVE'",1)
        assert sql('SELECT count(*) FROM public.attendance_records;').strip() == '2'
        # Manual reporting: admins may correct themselves and staff, never another station.
        def manual(member=201, target_station=station, start="2020-01-02 08:00", end="2020-01-02 16:00", reason="Correction"):
            out = "NULL" if end is None else f"'{end}'"
            return f"SELECT public.save_manual_attendance('{target_station}','{user(member)}',NULL,'{start}',{out},'{reason}',NULL)"
        for actor in [1, 2]:
            for member in [201, 203, 204]:
                output = attempt(actor, manual(member))
                assert 'MANUAL_ADMIN' in output and 'COMPLETED' in output, output
        assert 'ACTIVE' in attempt(2, manual(end=None))
        sql(f"UPDATE public.station_memberships SET status='SUSPENDED' WHERE id='{user(201)}'")
        attempt(2, manual(), True)
        sql(f"UPDATE public.station_memberships SET status='ACTIVE' WHERE id='{user(201)}'")
        for actor in [4, 5, 6]:
            attempt(actor, manual(), True)
        attempt(2, manual(205, other), True)
        attempt(2, manual(205), True)
        attempt(2, manual(start='2099-01-01 08:00'), True)
        attempt(2, manual(end='2020-01-02 07:00'), True)
        attempt(2, manual(reason=''), True)
        attempt(2, manual() + ';' + manual(), True)  # overlap
        attempt(2, f"UPDATE public.station_memberships SET status='INACTIVE' WHERE id='{user(203)}';" + manual(203), True)
        output = attempt(2, manual() + "; SELECT count(*) FROM public.attendance_manual_audit")
        assert '\n1\n' in output, output
        # Editing both timestamps, with optimistic concurrency and before/after audit snapshots.
        output = attempt(2, manual() + f""";
          SELECT public.save_manual_attendance('{station}','{user(201)}',id,
            '2020-01-02 09:00','2020-01-02 17:00','Updated times',updated_at)
          FROM public.attendance_records WHERE station_membership_id='{user(201)}';
          SELECT count(*) FROM public.attendance_manual_audit WHERE before_record IS NOT NULL""")
        assert 'Updated times' in output and '\n1\n' in output, output
        attempt(2, manual() + f"""; SELECT public.save_manual_attendance('{station}','{user(201)}',id,
          '2020-01-02 09:00','2020-01-02 17:00','Stale','1990-01-01')
          FROM public.attendance_records WHERE station_membership_id='{user(201)}'""", True)
        attempt(2, manual() + '; DELETE FROM public.attendance_manual_audit', True)
        print('PASS: manual attendance self/staff/platform; worker/shift-manager/cross-station denials; time/overlap/stale validation; immutable audit')
        print('PASS: all migrations; role changes; protected/self/cross-station/worker denial; admin creation denial; super-admin rights; station configuration; history preservation')
    finally:
        command('pg_ctl', '-D', str(base / 'data'), '-m', 'immediate', '-w', 'stop')
