'use client';
import { NavigationLink as Link } from './NavigationLink';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { MobileDock } from '@yellowshifts/ui';
import { CalendarIcon, BriefcaseIcon, ClockIcon, HomeIcon } from '@yellowshifts/icons';
export function WorkerDock() {
  const path = usePathname();
  const params = useSearchParams();
  const [visiblePath, setVisiblePath] = useState<string>();
  useEffect(() => setVisiblePath(path), [path]);
  const friendly = path.match(/^\/stations\/([^/]+)(?:\/(home|hours|availability))?\/?$/);
  const route = friendly ? (friendly[2] ? '/' + friendly[2] : '/') : path;
  const visibleFriendly = visiblePath?.match(/^\/stations\/([^/]+)/);
  if (route !== '/home' && route !== '/' && route !== '/availability' && route !== '/hours')
    return null;
  const station = visiblePath === undefined ? null : params.get('stationId');
  const query = station ? `?stationId=${encodeURIComponent(station)}` : '';
  const link = (target: string) =>
    visibleFriendly
      ? '/stations/' + visibleFriendly[1] + (target === '/' ? '' : target)
      : target + query;
  return (
    <MobileDock>
      <Link href={link('/home')} aria-current={route === '/home' ? 'page' : undefined}>
        <HomeIcon size={22} />
        <span>הבית שלי</span>
      </Link>
      <Link href={link('/')} aria-current={route === '/' ? 'page' : undefined}>
        <BriefcaseIcon size={22} />
        <span>המשמרות שלי</span>
      </Link>
      <Link
        href={link('/availability')}
        aria-current={route === '/availability' ? 'page' : undefined}
      >
        <CalendarIcon size={22} />
        <span>הזמינות שלי</span>
      </Link>
      <Link href={link('/hours')} aria-current={route === '/hours' ? 'page' : undefined}>
        <ClockIcon size={22} />
        <span>השעות שלי</span>
      </Link>
    </MobileDock>
  );
}
