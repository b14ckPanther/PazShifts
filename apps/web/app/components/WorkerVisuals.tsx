import type { CSSProperties } from 'react';
import { MoonGlyph, SunGlyph } from '@yellowshifts/icons';
import './worker-visuals.css';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Minutes since local midnight for an instant, in the station's zone. */
export function minutesInZone(value: string, zone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return pick('hour') * 60 + pick('minute');
}

/** Minutes since midnight for a scheduled wall time ("…THH:MM" or "HH:MM"). */
export function minutesOfWallTime(value: string) {
  const time = value.includes('T') ? (value.split('T')[1] ?? '') : value.slice(-8);
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Price-board counter: every digit sits on its own rolling drum, like a pump display.
 * The readable value is announced once; the drums are decoration.
 */
export function PumpDigits({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`pump-digits ys-num ${className}`} dir="ltr">
      <span className="ys-visually-hidden">{value}</span>
      <span className="pump-digits-drums" aria-hidden="true">
        {value.split('').map((char, index) =>
          /\d/.test(char) ? (
            <span key={index} className="pump-drum" style={{ '--d': char } as CSSProperties}>
              <span className="pump-drum-strip">
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={index} className="pump-sep">
              {char}
            </span>
          )
        )}
      </span>
    </span>
  );
}

/**
 * A 24-hour strip with the shift laid on it, so day, evening and overnight read at a glance.
 * Overnight shifts wrap: the tail continues from midnight.
 */
export function DayBar({
  start,
  end,
  tone = 'ink',
  now,
}: {
  start: number;
  end: number;
  tone?: 'ink' | 'crimson' | 'light';
  now?: number | null;
}) {
  const overnight = end <= start;
  const segments = overnight
    ? [
        [start, 1440],
        [0, end],
      ]
    : [[start, end]];
  const pct = (m: number) => `${(m / 1440) * 100}%`;
  return (
    <div className={`day-bar day-bar--${tone}`} aria-hidden="true">
      <SunGlyph size={14} className="day-bar-sun" />
      <div className="day-bar-track">
        {[6, 12, 18].map((h) => (
          <span key={h} className="day-bar-tick" style={{ insetInlineStart: pct(h * 60) }} />
        ))}
        {segments.map(([from = 0, to = 0], i) => (
          <span
            key={i}
            className="day-bar-shift"
            style={{ insetInlineStart: pct(from), width: pct(to - from) }}
          />
        ))}
        {now != null && <span className="day-bar-now" style={{ insetInlineStart: pct(now) }} />}
      </div>
      <MoonGlyph size={13} className="day-bar-moon" />
    </div>
  );
}
