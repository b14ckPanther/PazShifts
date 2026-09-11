'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MobileDock } from '@yellowshifts/ui';
import { StationIcon, CalendarIcon, NfcIcon, UsersIcon } from '@yellowshifts/icons';
export function StationDock({ stationId, admin }: { stationId: string; admin: boolean }) {
  const path = usePathname();
  const base = `/stations/${stationId}`;
  const items = admin
    ? [
        { href: base, label: 'התחנה', Icon: StationIcon },
        { href: `${base}/schedules`, label: 'סידור', Icon: CalendarIcon },
        { href: `${base}/attendance`, label: 'נוכחות', Icon: NfcIcon },
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
            (href === base ? path === href : path === href || path.startsWith(href + '/'))
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
