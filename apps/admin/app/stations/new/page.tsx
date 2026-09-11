import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, getAuthenticatedUserContext } from '@yellowshifts/database';
import { Container, PageHeader, Badge } from '@yellowshifts/ui';
import { CreateStationForm } from '../../components/CreateStationForm';
import { LogoutButton } from '../../components/LogoutButton';
import { PlatformAdminIcon } from '@yellowshifts/icons';

export default async function NewStationPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const context = await getAuthenticatedUserContext(supabase);

  if (!context) {
    redirect('/login');
  }

  // Only Platform Admin can create stations
  if (!context.isPlatformAdmin) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
          color: 'var(--ys-color-text-primary, #111827)',
          padding: '48px 16px',
          direction: 'rtl',
        }}
      >
        <Container size="sm">
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 'var(--ys-radius-md)',
              padding: '32px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <h2
              style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#111827' }}
            >
              הרשאה נדחתה
            </h2>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px 0' }}>
              הקמת תחנות חדשות במערכת מוגדרת עבור מנהל מערכת ראשי בלבד.
            </p>
            <a href="/" style={{ textDecoration: 'none' }}>
              <button
                type="button"
                style={{
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: 'var(--ys-radius-md)',
                  backgroundColor: '#F3F4F6',
                  color: '#111827',
                  border: '1px solid #D1D5DB',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                חזרה לפורטל הניהול
              </button>
            </a>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--ys-color-surface-base, #F8FAFC)',
        color: 'var(--ys-color-text-primary, #111827)',
        paddingBottom: '64px',
        direction: 'rtl',
      }}
    >
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '3px solid var(--ys-color-brand-yellow)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          padding: '16px 0',
        }}
      >
        <Container size="lg">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--ys-radius-sm)',
                  backgroundColor: 'var(--ys-color-brand-yellow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ys-color-text-primary)',
                }}
              >
                <PlatformAdminIcon size={22} />
              </div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--ys-color-text-primary, #111827)',
                }}
              >
                YellowShifts Admin • הקמת תחנה
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant="brandYellow" dot>
                מנהל פלטפורמה
              </Badge>
              <LogoutButton variant="outline" />
            </div>
          </div>
        </Container>
      </header>

      <Container size="md">
        <div style={{ margin: '32px 0 24px 0' }}>
          <PageHeader
            title="הקמת תחנה חדשה"
            description="הזן את פרטי התחנה. לאחר ההקמה תוכל להקצות לה מנהלי תחנה וצוות עובדים."
          />
        </div>

        <CreateStationForm />
      </Container>
    </main>
  );
}
