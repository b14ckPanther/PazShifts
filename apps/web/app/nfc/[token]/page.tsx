import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  createServerSupabaseClient,
  resolveStationByNfcToken,
  getWorkerActiveAttendance,
  getWorkerActiveAttendanceAnywhere,
} from '@yellowshifts/database';
import {
  Container,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from '@yellowshifts/ui';
import { ShieldAlertIcon, ArrowRightIcon } from '@yellowshifts/icons';
import { NfcAttendanceClient } from './NfcAttendanceClient';
import type { AttendanceRecord } from '@yellowshifts/types';

interface NfcStationPageProps {
  params: Promise<{ token: string }>;
}

export default async function NfcStationPage({ params }: NfcStationPageProps) {
  const { token } = await params;

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  // 1. Resolve Station by NFC Public Token
  const station = await resolveStationByNfcToken(supabase, token);

  // Polished Hebrew error state if invalid token or station inactive
  if (!station || !station.is_active) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
          padding: '24px 16px',
          direction: 'rtl',
        }}
      >
        <Container size="sm">
          <Card
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#EF4444',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#EF4444',
                  }}
                >
                  <ShieldAlertIcon size={24} />
                </div>
                <div>
                  <CardTitle style={{ color: '#EF4444' }}>תג NFC אינו מזוהה</CardTitle>
                  <CardDescription style={{ color: '#6B7280' }}>
                    שגיאה בזיהוי התחנה המבוקשת
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#374151', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
                מזהה התחנה המקודד בתג ה-NFC אינו קיים במערכת, בוטל, או שהתחנה סומנה כלא-פעילה. אנא
                ודא שסרקת את התג הנכון או פנה למנהל התחנה לעדכון מזהה ה-NFC.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/" style={{ width: '100%', textDecoration: 'none' }}>
                <Button variant="outline" fullWidth leftIcon={<ArrowRightIcon size={16} />}>
                  חזרה למסך הראשי
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </Container>
      </main>
    );
  }

  // 2. Authentication: If not authenticated, redirect preserving return path
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const returnDestination = `/nfc/${encodeURIComponent(token)}`;
    redirect(`/login?next=${encodeURIComponent(returnDestination)}`);
  }

  // Fetch worker profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle();

  const profile = profileData as { full_name: string; phone: string | null } | null;
  const workerName = profile?.full_name || 'עובד';

  // 3. Station Membership Verification
  const { data: memberData, error: membershipError } = await supabase
    .from('station_memberships')
    .select('id, role, status, employee_code')
    .eq('station_id', station.id)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  const membership = memberData as {
    id: string;
    role: string;
    status: string;
    employee_code: string | null;
  } | null;

  // Access denied if worker is not an ACTIVE member of this station
  if (membershipError || !membership) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
          padding: '24px 16px',
          direction: 'rtl',
        }}
      >
        <Container size="sm">
          <Card
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#F59E0B',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#F59E0B',
                  }}
                >
                  <ShieldAlertIcon size={24} />
                </div>
                <div>
                  <CardTitle style={{ color: '#F59E0B' }}>אין הרשאת כניסה לתחנה זו</CardTitle>
                  <CardDescription style={{ color: '#6B7280' }}>
                    {station.name} (קוד {station.code})
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#374151', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
                שלום <strong>{workerName}</strong>, אינך משויך כעובד פעיל בתחנה זו במערכת
                YellowShifts. לא ניתן לבצע דיווח נוכחות או שעון כניסה בתחנה שאינה משויכת לחשבונך.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/" style={{ width: '100%', textDecoration: 'none' }}>
                <Button variant="outline" fullWidth leftIcon={<ArrowRightIcon size={16} />}>
                  חזרה למסך הראשי
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </Container>
      </main>
    );
  }

  // 4. Check for active attendance across ANY station
  const activeAnywhere = await getWorkerActiveAttendanceAnywhere(supabase, user.id);
  const crossStationConflict =
    activeAnywhere && activeAnywhere.station_id !== station.id
      ? { stationName: activeAnywhere.station_name }
      : null;

  // 5. Check active attendance at this station
  const initialActiveRecord: AttendanceRecord | null =
    activeAnywhere && activeAnywhere.station_id === station.id
      ? (activeAnywhere as AttendanceRecord)
      : await getWorkerActiveAttendance(supabase, membership.id);

  // 6. Look for closest scheduled shift for today
  let scheduledShiftInfo = null;
  const { data: assignments } = await supabase
    .from('shift_assignments')
    .select(
      `
      scheduled_shifts!inner (
        id,
        shift_date,
        start_at,
        end_at,
        shift_templates:shift_template_id (
          name
        )
      )
    `
    )
    .eq('station_id', station.id)
    .eq('station_membership_id', membership.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentList = (assignments || []) as any[];
  if (assignmentList.length > 0) {
    const candidate = assignmentList[0]?.scheduled_shifts;
    if (candidate) {
      scheduledShiftInfo = {
        id: candidate.id,
        shift_date: candidate.shift_date,
        start_at: candidate.start_at,
        end_at: candidate.end_at,
        templateName: candidate.shift_templates?.name,
      };
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        direction: 'rtl',
      }}
    >
      <Container size="sm">
        {/* YellowShifts Brand Accent */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--ys-color-brand-yellow)',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>
              YellowShifts NFC Attendance
            </span>
          </div>

          <Link
            href="/"
            style={{
              fontSize: '12px',
              color: '#4B5563',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            לפורטל האישי
            <ArrowRightIcon size={12} />
          </Link>
        </div>

        {/* Mobile Attendance Client */}
        <NfcAttendanceClient
          station={station}
          workerName={workerName}
          membershipId={membership.id}
          nfcToken={token}
          initialActiveRecord={initialActiveRecord}
          crossStationConflict={crossStationConflict}
          scheduledShift={scheduledShiftInfo}
        />
      </Container>
    </main>
  );
}
