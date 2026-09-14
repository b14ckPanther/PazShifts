/**
 * Compatibility boundary for calculateShiftTimestamps: scheduled_shifts stores
 * station wall-clock components in a UTC representation. Attendance timestamps
 * are real instants and MUST NOT pass through this adapter.
 * Keep this until a coordinated storage/writer/server migration replaces that contract.
 */
export function scheduledWallTimeToInstant(stored: string, timezone: string): string {
  const wall = Date.parse(stored);
  if (!Number.isFinite(wall)) throw Error('Invalid schedule time');
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const localValue = (instant: number) => {
    const parts = format.formatToParts(new Date(instant));
    const part = (key: string) => Number(parts.find((p) => p.type === key)!.value);
    return Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
      part('second'),
      new Date(instant).getUTCMilliseconds()
    );
  };
  // Sample both sides of a DST boundary; choose the earlier occurrence when a
  // clock hour repeats. Nonexistent spring-forward times fail rather than drift.
  const candidates = [-86400000, 0, 86400000]
    .map((delta) => {
      const probe = wall + delta;
      return wall - (localValue(probe) - probe);
    })
    .filter((candidate) => localValue(candidate) === wall);
  if (!candidates.length) throw Error('Nonexistent station schedule time');
  return new Date(Math.min(...candidates)).toISOString();
}
