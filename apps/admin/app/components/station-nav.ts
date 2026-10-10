import type { ComponentType } from 'react';
import {
  CanopyGlyph,
  ClockGlyph,
  RosterGlyph,
  StopwatchGlyph,
  TeamGlyph,
  type GlyphProps,
} from '@yellowshifts/icons';

export interface StationNavItem {
  href: string;
  label: string;
  Icon: ComponentType<GlyphProps>;
}

/** One source for the station section tabs in the header (phone track and desktop pills). */
export function stationNavItems(base: string, admin: boolean): StationNavItem[] {
  return admin
    ? [
        { href: base, label: 'התחנה', Icon: CanopyGlyph },
        { href: `${base}/schedules`, label: 'סידור', Icon: RosterGlyph },
        { href: `${base}/attendance`, label: 'נוכחות', Icon: ClockGlyph },
        { href: `${base}/reports`, label: 'שעות', Icon: StopwatchGlyph },
        { href: `${base}/staff`, label: 'צוות', Icon: TeamGlyph },
      ]
    : [
        { href: '/', label: 'התחנות שלי', Icon: CanopyGlyph },
        { href: `${base}/schedules`, label: 'סידור עבודה', Icon: RosterGlyph },
      ];
}

export function isStationNavActive(href: string, base: string, activePath: string) {
  return href === base
    ? activePath === href
    : activePath === href || activePath.startsWith(href + '/');
}
