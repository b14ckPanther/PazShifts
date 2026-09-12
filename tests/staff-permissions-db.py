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
        # Removal/stop use the same worker lock, retain replay tombstones and clear overlap.
        sql(f"""INSERT INTO public.attendance_records(id,station_id,station_membership_id,user_id,clock_in_at,status)
          VALUES ('{user(601)}','{station}','{user(201)}','{user(2)}','2020-01-02 08:00Z','ACTIVE');
          INSERT INTO public.nfc_scan_receipts(user_id,scan_id,station_id,attendance_id,action,applied_at)
          VALUES ('{user(2)}','{user(602)}','{station}','{user(601)}','CLOCK_IN',now());""")
        manage = f"SELECT public.manage_attendance_record('{station}','{user(601)}','DELETE','Mistaken test',(SELECT updated_at FROM public.attendance_records WHERE id='{user(601)}'))"
        for actor in [4,5,6]: attempt(actor,manage,True)
        attempt(2,manage.replace(station,other),True)
        attempt(2,manage.replace("'Mistaken test'","''"),True)
        attempt(2,manage.replace("(SELECT updated_at FROM public.attendance_records WHERE id='"+user(601)+"')","'1990-01-01'"),True)
        for actor in [1,2]:
            result=attempt(actor,manage+f"; SELECT count(*) FROM public.attendance_removals WHERE attendance_record_id='{user(601)}'")
            assert '\n1\n' in result,result
        result=attempt(2,manage.replace("'DELETE'","'CLOSE'")+f"; SELECT status FROM public.attendance_records WHERE id='{user(601)}'; SELECT count(*) FROM public.attendance_manual_audit WHERE attendance_record_id='{user(601)}'")
        assert 'COMPLETED' in result and '\n1\n' in result,result
        attempt(2,manual(),True)
        result=attempt(2,manage+';'+manual()+f"; SELECT public.process_nfc_scan((SELECT nfc_public_token FROM public.stations WHERE id='{station}'),'{user(602)}',now(),'scan')")
        assert 'STALE_CHECKOUT' in result,result
        attempt(2,manage+';'+manage) # safe retry after deletion
        attempt(2,'DELETE FROM public.attendance_removals',True)
        sql(f"DELETE FROM public.nfc_scan_receipts WHERE scan_id='{user(602)}'; DELETE FROM public.attendance_records WHERE id='{user(601)}';")
        print('PASS: stop/delete admin/platform, scope and stale denials, removal audit, replay denial and cleared overlap')
        # Station-owned hour rules: database authorization and immutable versions.
        rules = '{"dailyMinutes":[480,480,480,480,480,480,480],"firstOvertimeMinutes":120,"firstRate":125,"secondRate":150,"weeklyMinutes":2520,"weekStartsOn":1,"breakMinutes":0,"breakAfterMinutes":360,"nightStart":1320,"nightEnd":360,"nightRate":100,"restDays":[],"restRate":150,"holidays":[],"holidayRate":150}'
        save_rules = f"SELECT public.save_station_hour_rules('{station}','2020-01-06','{rules}',true)"
        for actor in (1,2,3): attempt(actor,save_rules)
        for actor in (4,5,6,7): attempt(actor,save_rules,True)
        attempt(2,save_rules.replace('2020-01-06','2020-01-07'),True)
        attempt(2,save_rules.replace('125','99'),True)
        attempt(2,save_rules.replace(',true)',',false)'),True)
        attempt(2,save_rules+'; '+save_rules,True)
        future_rules = save_rules.replace("'2020-01-06'", "(date_trunc('week',current_date+interval '14 days'))::date")
        result = attempt(2,save_rules+'; '+future_rules+'; '+future_rules+f"; SELECT jsonb_array_length(public.get_station_hour_rules('{station}'))")
        assert '\n3\n' in result, result
        attempt(4,f"SELECT public.get_station_hour_rules('{station}')")
        attempt(6,f"SELECT public.get_station_hour_rules('{station}')",True)
        attempt(2,"DELETE FROM public.station_hour_rules",True)
        attempt(2,"UPDATE public.station_hour_rules SET rules='{}'",True)
        print('PASS: hour-rule validation, admin/platform writes, own-member reads, immutable past versions and cross-station denials')
        # Test-account cleanup is opt-in, dependency-aware and reversible by default.
        sql(f"INSERT INTO public.station_memberships(id,station_id,user_id,role) VALUES ('{user(207)}','{station}','{user(7)}','WORKER');")
        sql(f"INSERT INTO public.attendance_records(id,station_id,station_membership_id,user_id,clock_in_at,clock_out_at,status) VALUES ('{user(301)}','{station}','{user(207)}','{user(7)}','2020-01-01T08:00:00Z','2020-01-01T16:00:00Z','COMPLETED');")
        sql(f"INSERT INTO public.attendance_manual_audit(station_id,attendance_record_id,actor_id,reason,after_record) VALUES ('{station}','{user(301)}','{user(2)}','test','{{}}');")
        sql(f"INSERT INTO public.nfc_scan_receipts(user_id,scan_id,station_id,attendance_id,action,applied_at) VALUES ('{user(7)}','{user(401)}','{station}','{user(301)}','CLOCK_IN',now());")
        cleanup=(ROOT / 'scripts/delete-test-accounts.sql').read_text()
        sql(cleanup,True)
        sql(cleanup.replace('00000000-0000-0000-0000-000000000000',user(2)),True)
        selected=cleanup.replace('00000000-0000-0000-0000-000000000000',user(7))
        sql(selected)
        assert sql(f"SELECT count(*) FROM auth.users WHERE id='{user(7)}'").strip()=='1'
        sql(selected.replace('ROLLBACK; -- Change','COMMIT; -- Change'))
        assert sql(f"SELECT count(*) FROM auth.users WHERE id='{user(7)}'").strip()=='0'
        assert sql('SELECT count(*) FROM auth.users').strip()=='6'
        print('PASS: test-account cleanup rollback/commit, admin guard and dependent attendance/audit/receipt deletion')
    finally:
        command('pg_ctl', '-D', str(base / 'data'), '-m', 'immediate', '-w', 'stop')
