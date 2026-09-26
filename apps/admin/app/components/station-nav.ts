import type { ComponentType } from 'react';
import {
  StationIcon,
  CalendarIcon,
  UsersIcon,
  ClockIcon,
  ReportIcon,
  type IconProps,
} from '@yellowshifts/icons';

export interface StationNavItem {
  href: string;
  label: string;
  Icon: ComponentType<IconProps>;
}

/** One source for the phone tab bar and the desktop header tabs. */
export function stationNavItems(base: string, admin: boolean): StationNavItem[] {
  return admin
    ? [
        { href: base, label: 'התחנה', Icon: StationIcon },
        { href: `${base}/schedules`, label: 'סידור', Icon: CalendarIcon },
        { href: `${base}/attendance`, label: 'נוכחות', Icon: ClockIcon },
        { href: `${base}/reports`, label: 'שעות', Icon: ReportIcon },
        { href: `${base}/staff`, label: 'צוות', Icon: UsersIcon },
      ]
    : [
        { href: '/', label: 'התחנות שלי', Icon: StationIcon },
        { href: `${base}/schedules`, label: 'סידור עבודה', Icon: CalendarIcon },
      ];
}

export function isStationNavActive(href: string, base: string, activePath: string) {
  return href === base
    ? activePath === href
    : activePath === href || activePath.startsWith(href + '/');
}
