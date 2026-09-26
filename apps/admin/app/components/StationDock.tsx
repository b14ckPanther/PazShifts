'use client';
import { NavigationLink as Link } from './NavigationLink';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MobileDock } from '@yellowshifts/ui';
import { isStationNavActive, stationNavItems } from './station-nav';

export function StationDock({ stationId, admin }: { stationId: string; admin: boolean }) {
  const path = usePathname();
  // Rewrites can render a UUID internally; use the browser path after hydration.
  const [visibleBase, setVisibleBase] = useState<string>();
  useEffect(() => {
    setVisibleBase(path.match(/^\/stations\/[^/]+/)?.[0]);
  }, [path]);
  const base = visibleBase || `/stations/${stationId}`;
  const activePath = path.replace(/^\/stations\/[^/]+/, base);
  return (
    <MobileDock>
      {stationNavItems(base, admin).map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isStationNavActive(href, base, activePath) ? 'page' : undefined}
        >
          <Icon size={22} />
          <span>{label}</span>
        </Link>
      ))}
    </MobileDock>
  );
}
