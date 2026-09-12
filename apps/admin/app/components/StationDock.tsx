'use client';
import { NavigationLink as Link } from './NavigationLink';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MobileDock } from '@yellowshifts/ui';
import { StationIcon, CalendarIcon, NfcIcon, UsersIcon, ClockIcon } from '@yellowshifts/icons';
export function StationDock({ stationId, admin }: { stationId: string; admin: boolean }) {
  const path = usePathname();
  // Rewrites can render a UUID internally; use the browser path after hydration.
  const [visibleBase, setVisibleBase] = useState<string>();
  useEffect(() => {
    setVisibleBase(path.match(/^\/stations\/[^/]+/)?.[0]);
  }, [path]);
  const base = visibleBase || `/stations/${stationId}`;
  const activePath = path.replace(/^\/stations\/[^/]+/, base);
  const items = admin
    ? [
        { href: base, label: 'התחנה', Icon: StationIcon },
        { href: `${base}/schedules`, label: 'סידור', Icon: CalendarIcon },
        { href: `${base}/attendance`, label: 'נוכחות', Icon: NfcIcon },
        { href: `${base}/reports`, label: 'שעות', Icon: ClockIcon },
        { href: `${base}/staff`, label: 'צוות', Icon: UsersIcon },
      ]
    : [
        { href: '/', label: 'התחנות שלי', Icon: StationIcon },
        { href: `${base}/schedules`, label: 'סידור עבודה', Icon: CalendarIcon },
      ];
  return (
    <MobileDock>
      {items.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            (
              href === base
                ? activePath === href
                : activePath === href || activePath.startsWith(href + '/')
            )
              ? 'page'
              : undefined
          }
        >
          <Icon size={22} />
          <span>{label}</span>
        </Link>
      ))}
    </MobileDock>
  );
}
