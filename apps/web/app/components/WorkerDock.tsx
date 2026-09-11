'use client';
import { NavigationLink as Link } from './NavigationLink';
import { usePathname, useSearchParams } from 'next/navigation';
import { MobileDock } from '@yellowshifts/ui';
import { CalendarIcon, BriefcaseIcon } from '@yellowshifts/icons';
export function WorkerDock() {
  const path = usePathname();
  const params = useSearchParams();
  if (path !== '/' && path !== '/availability') return null;
  const station = params.get('stationId');
  const query = station ? `?stationId=${encodeURIComponent(station)}` : '';
  return (
    <MobileDock>
      <Link href={`/${query}`} aria-current={path === '/' ? 'page' : undefined}>
        <BriefcaseIcon size={22} />
        <span>המשמרות שלי</span>
      </Link>
      <Link
        href={`/availability${query}`}
        aria-current={path === '/availability' ? 'page' : undefined}
      >
        <CalendarIcon size={22} />
        <span>הזמינות שלי</span>
      </Link>
    </MobileDock>
  );
}
