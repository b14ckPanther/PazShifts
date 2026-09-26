import { NavigationLink as Link } from './NavigationLink';
import {
  CalendarIcon,
  ChevronLeftIcon,
  LayoutGridIcon,
  SettingsIcon,
  TimerIcon,
  WarningIcon,
  CircleCheckIcon,
} from '@yellowshifts/icons';

/** Read-only facts for the overview status strip; `null` means the read failed. */
export interface StationLiveStatus {
  onShift: { count: number; names: string[] } | null;
  exceptionsToday: number | null;
  schedule: {
    state: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'NONE';
    shiftCount: number;
    missingManager: number;
  } | null;
}

const UNAVAILABLE = 'לא זמין כרגע';

function namesLine(names: string[], count: number) {
  if (!count) return 'אין עובדים במשמרת כרגע';
  const shown = names.slice(0, 3).join(', ');
  return count > 3 ? `${shown} ועוד ${count - 3}` : shown;
}

const SCHEDULE_LABEL: Record<NonNullable<StationLiveStatus['schedule']>['state'], string> = {
  PUBLISHED: 'פורסם',
  DRAFT: 'טיוטה, טרם פורסם',
  ARCHIVED: 'בארכיון',
  NONE: 'טרם נבנה',
};

/** Live control-room strip: who is on now, what needs attention, schedule state. */
export function StationStatusStrip({
  stationId,
  status,
}: {
  stationId: string;
  status: StationLiveStatus;
}) {
  const base = `/stations/${stationId}`;
  const { onShift, exceptionsToday, schedule } = status;
  // Only an unpublished week colours the whole cell; missing managers get their own line.
  const scheduleNeedsAttention = !!schedule && schedule.state !== 'PUBLISHED';

  return (
    <section className="station-status-strip" aria-label="מצב התחנה עכשיו">
      <Link
        href={`${base}/attendance`}
        className={`station-status-item${onShift && onShift.count > 0 ? ' is-live' : ''}`}
      >
        <span className="station-status-label">
          <TimerIcon size={16} aria-hidden="true" />
          במשמרת עכשיו
        </span>
        {onShift ? (
          <>
            <span className="station-status-value ys-num">{onShift.count}</span>
            <span className="station-status-detail">{namesLine(onShift.names, onShift.count)}</span>
          </>
        ) : (
          <span className="station-status-detail">{UNAVAILABLE}</span>
        )}
      </Link>

      <Link
        href={`${base}/exceptions`}
        className={`station-status-item${exceptionsToday ? ' is-attention' : ''}`}
      >
        <span className="station-status-label">
          <WarningIcon size={16} aria-hidden="true" />
          חריגות נוכחות היום
        </span>
        {exceptionsToday === null ? (
          <span className="station-status-detail">{UNAVAILABLE}</span>
        ) : (
          <>
            <span className="station-status-value ys-num">{exceptionsToday}</span>
            <span className="station-status-detail">
              {exceptionsToday ? 'דורשות בדיקה' : 'אין חריגות היום'}
            </span>
          </>
        )}
      </Link>

      <Link
        href={`${base}/schedules`}
        className={`station-status-item${scheduleNeedsAttention ? ' is-attention' : ''}`}
      >
        <span className="station-status-label">
          <CalendarIcon size={16} aria-hidden="true" />
          סידור השבוע
        </span>
        {schedule ? (
          <>
            <span
              className={`station-status-state${schedule.state === 'PUBLISHED' ? ' is-success' : ''}`}
            >
              {schedule.state === 'PUBLISHED' && <CircleCheckIcon size={18} aria-hidden="true" />}
              {SCHEDULE_LABEL[schedule.state]}
            </span>
            <span className="station-status-detail">
              {schedule.state === 'NONE' ? (
                'אין משמרות לשבוע הנוכחי'
              ) : schedule.missingManager > 0 ? (
                <span className="station-status-warning">
                  <WarningIcon size={14} aria-hidden="true" />
                  <span>
                    <span className="ys-num">{schedule.missingManager}</span> מתוך{' '}
                    <span className="ys-num">{schedule.shiftCount}</span> משמרות ללא אחמ״ש
                  </span>
                </span>
              ) : (
                <>
                  <span className="ys-num">{schedule.shiftCount}</span> משמרות, לכולן יש אחמ״ש
                </>
              )}
            </span>
          </>
        ) : (
          <span className="station-status-detail">{UNAVAILABLE}</span>
        )}
      </Link>
    </section>
  );
}

/** Destinations that are not in the header tabs / phone dock. */
export function StationOperations({ stationId }: { stationId: string }) {
  const items = [
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
      Icon: LayoutGridIcon,
    },
    {
      path: 'reports/settings',
      title: 'כללי שעות ותוספות',
      text: 'מכסות, שעות נוספות, לילה, מנוחה וחגים.',
      Icon: SettingsIcon,
    },
  ];
  return (
    <nav className="station-more" aria-labelledby="station-more-title">
      <h2 id="station-more-title" className="station-more-title">
        עוד בתחנה
      </h2>
      <ul className="station-more-list">
        {items.map(({ path, title, text, Icon }) => (
          <li key={path}>
            <Link className="station-more-link" href={`/stations/${stationId}/${path}`}>
              <Icon className="station-more-icon" size={18} aria-hidden="true" />
              <span className="station-more-body">
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
              <ChevronLeftIcon className="station-more-chevron" size={18} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
