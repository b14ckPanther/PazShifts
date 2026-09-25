import { NavigationLink as Link } from './NavigationLink';
import { CalendarIcon, ClockIcon, WarningIcon, UsersIcon } from '@yellowshifts/icons';

export function StationOperations({ stationId }: { stationId: string }) {
  const items = [
    {
      path: 'schedules',
      title: 'סידור עבודה שבועי',
      text: 'תכנון משמרות, שיבוץ הצוות ופרסום הסידור.',
      Icon: CalendarIcon,
    },
    {
      path: 'attendance',
      title: 'נוכחות עובדים',
      text: 'מי במשמרת עכשיו, עריכת כניסה ויציאה ודיווח ידני.',
      Icon: ClockIcon,
    },
    {
      path: 'reports',
      title: 'דוח שעות עבודה',
      text: 'סיכומים יומיים ושבועיים, ייצוא PDF ו־CSV לחשבונאות.',
      Icon: ClockIcon,
    },
    {
      path: 'staff',
      title: 'צוות התחנה',
      text: 'פרטי עובדים, תפקידים וגישה לתחנה.',
      Icon: UsersIcon,
    },
    {
      path: 'exceptions',
      title: 'חריגות נוכחות',
      text: 'איחורים, יציאות מוקדמות ומשמרות פתוחות.',
      Icon: WarningIcon,
    },
    {
      path: 'templates',
      title: 'תבניות משמרת',
      text: 'הגדרת שעות המשמרות הקבועות בתחנה.',
      Icon: ClockIcon,
    },
  ];
  return (
    <nav className="station-operations" aria-label="ניהול התחנה">
      {items.map(({ path, title, text, Icon }) => (
        <Link className="station-operation" key={path} href={`/stations/${stationId}/${path}`}>
          <span className="station-operation-icon">
            <Icon size={22} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
          <span aria-hidden="true">←</span>
        </Link>
      ))}
    </nav>
  );
}
