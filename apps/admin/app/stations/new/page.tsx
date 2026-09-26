import { getServerContext } from '@/app/lib/server-context';
import { redirect } from 'next/navigation';
import { Container, PageHeader, EmptyState } from '@yellowshifts/ui';
import { LockIcon } from '@yellowshifts/icons';
import { AdminHeader } from '@/app/components/AdminHeader';
import { CreateStationForm } from '../../components/CreateStationForm';

export default async function NewStationPage() {
  const { context } = await getServerContext();

  if (!context) {
    redirect('/login');
  }

  // Only Platform Admin can create stations
  if (!context.isPlatformAdmin) {
    return (
      <main className="admin-page">
        <AdminHeader title="YellowShifts" subtitle="הקמת תחנה" homeHref="/" context={context} />
        <Container size="sm">
          <div className="admin-page-body admin-access-body">
            <EmptyState
              className="admin-empty-panel"
              icon={<LockIcon size={26} />}
              title="הרשאה נדחתה"
              description="הקמת תחנות חדשות במערכת מוגדרת עבור מנהל מערכת ראשי בלבד."
              action={
                <a href="/" className="ys-button ys-button--secondary">
                  חזרה לפורטל הניהול
                </a>
              }
            />
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminHeader title="YellowShifts" subtitle="הקמת תחנה" homeHref="/" context={context} />

      <Container size="lg">
        <div className="admin-page-body station-form-page">
          <PageHeader
            title="הקמת תחנה חדשה"
            description="הזן את פרטי התחנה. לאחר ההקמה תוכל להקצות לה מנהלי תחנה וצוות עובדים."
          />

          <CreateStationForm />
        </div>
      </Container>
    </main>
  );
}
