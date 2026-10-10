/**
 * YellowShifts glyphs: the worker app's own drawn icon set.
 *
 * Every glyph is built from up to three layers so one drawing serves three weights:
 * - `base`: the body of the object (outlined in `line`, tinted in `duo`, filled in `solid`)
 * - `line`: strokes that stay strokes in every variant (legs, handles, rays)
 * - `knock`: details drawn on the body; in `solid` they are knocked out in
 *   `var(--glyph-knock)` so a filled glyph keeps its inner drawing.
 */

import React from 'react';

export type GlyphVariant = 'line' | 'duo' | 'solid';

export interface GlyphProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
  variant?: GlyphVariant;
  strokeWidth?: number;
}

interface GlyphLayers {
  base?: React.ReactNode;
  line?: React.ReactNode;
  knock?: React.ReactNode;
}

function glyph(name: string, layers: GlyphLayers) {
  const Glyph: React.FC<GlyphProps> = ({
    size = 24,
    variant = 'line',
    strokeWidth = 1.75,
    ...props
  }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={props['aria-label'] ? undefined : true}
      data-glyph={name}
      data-variant={variant}
      {...props}
    >
      {layers.base && (
        <g
          fill={variant === 'line' ? 'none' : 'currentColor'}
          fillOpacity={variant === 'duo' ? 0.2 : 1}
        >
          {layers.base}
        </g>
      )}
      {layers.line}
      {layers.knock && (
        <g stroke={variant === 'solid' ? 'var(--glyph-knock, #fff)' : 'currentColor'}>
          {layers.knock}
        </g>
      )}
    </svg>
  );
  Glyph.displayName = name;
  return Glyph;
}

/* ---------- Navigation ---------- */

/** Home: the forecourt canopy over a pump, the station the worker walks into. */
export const CanopyGlyph = glyph('CanopyGlyph', {
  base: (
    <>
      <path d="M3.5 4.25h17a1 1 0 0 1 .95 1.3l-.6 1.9a1.5 1.5 0 0 1-1.43 1.05H4.58a1.5 1.5 0 0 1-1.43-1.05l-.6-1.9a1 1 0 0 1 .95-1.3Z" />
      <rect x="9" y="11.25" width="6" height="8.75" rx="1.6" />
    </>
  ),
  line: <path d="M5.75 8.5V20M18.25 8.5V20M3 20h18" />,
  knock: <path d="M11 14.25h2" />,
});

/** Shifts: the published roster on a clipboard. */
export const RosterGlyph = glyph('RosterGlyph', {
  base: (
    <>
      <rect x="4.25" y="4.5" width="15.5" height="17" rx="3.25" />
      <rect x="8.5" y="2.75" width="7" height="3.5" rx="1.25" />
    </>
  ),
  knock: <path d="M8.25 11h7.5M8.25 14.5h7.5M8.25 18h4.25" />,
});

/** Availability: a week page with a confirmed day. */
export const AvailabilityGlyph = glyph('AvailabilityGlyph', {
  base: <rect x="3.25" y="5" width="17.5" height="15.75" rx="3.5" />,
  line: <path d="M8 3v3.5M16 3v3.5" />,
  knock: <path d="M3.5 10h17M8.75 15.25l2.2 2.2 4.3-4.45" />,
});

/** Hours: a stopwatch, the shift counted. */
export const StopwatchGlyph = glyph('StopwatchGlyph', {
  base: <circle cx="12" cy="13.5" r="7.75" />,
  line: <path d="M10 2.75h4M12 2.75v3M18.5 6.25l1.25-1.25" />,
  knock: <path d="M12 9.75v3.75l2.5 2" />,
});

/* ---------- Actions and objects ---------- */

export const CalendarGlyph = glyph('CalendarGlyph', {
  base: <rect x="3.25" y="5" width="17.5" height="15.75" rx="3.5" />,
  line: <path d="M8 3v3.5M16 3v3.5" />,
  knock: (
    <>
      <path d="M3.5 10h17" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.25h.01M12 17.25h.01" strokeWidth={2.4} />
    </>
  ),
});

export const ClockGlyph = glyph('ClockGlyph', {
  base: <circle cx="12" cy="12" r="8.75" />,
  knock: <path d="M12 7.5V12l3 2" />,
});

/** NFC: the tap, waves leaving the tag. */
export const TapGlyph = glyph('TapGlyph', {
  base: <circle cx="5.5" cy="12" r="1.75" />,
  line: (
    <path d="M9.25 8.25a5.3 5.3 0 0 1 0 7.5M12.75 5.25a9.5 9.5 0 0 1 0 13.5M16.25 2.75a13 13 0 0 1 0 18.5" />
  ),
});

export const RefreshGlyph = glyph('RefreshGlyph', {
  line: (
    <path d="M19.75 11.25A7.85 7.85 0 0 0 5.9 6.85L4.25 8.5M4.25 4.25V8.5H8.5M4.25 12.75a7.85 7.85 0 0 0 13.85 4.4l1.65-1.65M19.75 19.75V15.5H15.5" />
  ),
});

export const ChevronStartGlyph = glyph('ChevronStartGlyph', {
  line: <path d="M9.5 6l6 6-6 6" />,
});

export const ChevronEndGlyph = glyph('ChevronEndGlyph', {
  line: <path d="M14.5 6l-6 6 6 6" />,
});

export const SunGlyph = glyph('SunGlyph', {
  base: <circle cx="12" cy="12" r="4" />,
  line: (
    <path d="M12 2.75v1.5M12 19.75v1.5M2.75 12h1.5M19.75 12h1.5M5.45 5.45l1.06 1.06M17.49 17.49l1.06 1.06M5.45 18.55l1.06-1.06M17.49 6.51l1.06-1.06" />
  ),
});

export const MoonGlyph = glyph('MoonGlyph', {
  base: <path d="M19.75 14.6A8.25 8.25 0 1 1 9.4 4.25a6.6 6.6 0 0 0 10.35 10.35Z" />,
});

export const TeamGlyph = glyph('TeamGlyph', {
  base: <circle cx="9" cy="8" r="3.5" />,
  line: <path d="M2.75 20a6.25 6.25 0 0 1 12.5 0M15.5 4.65a3.5 3.5 0 0 1 0 6.7M17.75 14.25A6.25 6.25 0 0 1 21.25 20" />,
});

export const DownloadGlyph = glyph('DownloadGlyph', {
  line: (
    <path d="M12 3.75v10.5M7.75 10.25 12 14.5l4.25-4.25M4 15.25v2.25A2.75 2.75 0 0 0 6.75 20.25h10.5A2.75 2.75 0 0 0 20 17.5v-2.25" />
  ),
});

export const DocumentGlyph = glyph('DocumentGlyph', {
  base: <path d="M7 2.75h7l4.75 4.75V18.5a2.75 2.75 0 0 1-2.75 2.75H7a2.75 2.75 0 0 1-2.75-2.75v-13A2.75 2.75 0 0 1 7 2.75Z" />,
  knock: <path d="M14 2.75V7.5h4.75M8.25 12.5h7.5M8.25 16h5" />,
});

export const SheetGlyph = glyph('SheetGlyph', {
  base: <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="3" />,
  knock: <path d="M3.75 9.25h16.5M3.75 14.75h16.5M9.75 9.25v11" />,
});

export const CheckGlyph = glyph('CheckGlyph', {
  line: <path d="M5 12.75 9.5 17.25 19 7.25" />,
});

export const CheckCircleGlyph = glyph('CheckCircleGlyph', {
  base: <circle cx="12" cy="12" r="8.75" />,
  knock: <path d="M8.25 12.25l2.6 2.6 5-5.35" />,
});

export const UnavailableGlyph = glyph('UnavailableGlyph', {
  base: <circle cx="12" cy="12" r="8.75" />,
  knock: <path d="M8.75 8.75l6.5 6.5M15.25 8.75l-6.5 6.5" />,
});

export const WindowGlyph = glyph('WindowGlyph', {
  base: <circle cx="12" cy="12" r="8.75" />,
  knock: <path d="M12 7.5V12h4" />,
});

export const AlertGlyph = glyph('AlertGlyph', {
  base: (
    <path d="M10.3 4.3 2.95 17.2a1.95 1.95 0 0 0 1.7 2.92h14.7a1.95 1.95 0 0 0 1.7-2.92L13.7 4.3a1.95 1.95 0 0 0-3.4 0Z" />
  ),
  knock: (
    <>
      <path d="M12 9.5v4" />
      <path d="M12 16.75h.01" strokeWidth={2.4} />
    </>
  ),
});

export const PinGlyph = glyph('PinGlyph', {
  base: <path d="M12 21.25s-6.75-5.7-6.75-11.25a6.75 6.75 0 0 1 13.5 0c0 5.55-6.75 11.25-6.75 11.25Z" />,
  knock: <circle cx="12" cy="10" r="2.4" />,
});

export const SendGlyph = glyph('SendGlyph', {
  base: <path d="M3.4 10.6 20.25 3.75 13.4 20.6l-2.75-6.85Z" />,
  knock: <path d="m10.65 13.75 9.6-10" />,
});

export const CloseGlyph = glyph('CloseGlyph', {
  line: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
});

export const OfflineGlyph = glyph('OfflineGlyph', {
  line: (
    <>
      <path d="M2.75 8.75a14 14 0 0 1 4.6-2.9M10.9 5.1A14 14 0 0 1 21.25 8.75M5.75 12.25a9.5 9.5 0 0 1 3.4-2.1M15.25 10.6a9.5 9.5 0 0 1 3 1.65M8.9 15.6a5 5 0 0 1 6.2 0M3.5 3.5l17 17" />
      <path d="M12 19.25h.01" strokeWidth={2.6} />
    </>
  ),
});

export const HourglassGlyph = glyph('HourglassGlyph', {
  base: <path d="M7 3.25h10v3.2a5 5 0 0 1-2.2 4.15L12 12.5l-2.8-1.9A5 5 0 0 1 7 6.45Zm0 17.5h10v-3.2a5 5 0 0 0-2.2-4.15L12 11.5l-2.8 1.9A5 5 0 0 0 7 17.55Z" />,
  line: <path d="M5.5 3.25h13M5.5 20.75h13" />,
});

export const LogoutGlyph = glyph('LogoutGlyph', {
  line: (
    <path d="M14.25 4.25H17.5a2.25 2.25 0 0 1 2.25 2.25v11a2.25 2.25 0 0 1-2.25 2.25h-3.25M9.75 8 5.75 12l4 4M5.75 12h9.5" />
  ),
});

export const BellGlyph = glyph('BellGlyph', {
  base: <path d="M6 9.75a6 6 0 0 1 12 0v3.4l1.6 2.65a1 1 0 0 1-.86 1.5H5.26a1 1 0 0 1-.86-1.5L6 13.15Z" />,
  line: <path d="M9.75 20a2.4 2.4 0 0 0 4.5 0" />,
});

export const MenuGlyph = glyph('MenuGlyph', {
  line: <path d="M4 7h16M4 12h10M4 17h16" />,
});

export const StationGlyph = CanopyGlyph;
