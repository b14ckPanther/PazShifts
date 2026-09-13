import type { ReminderContext } from '@yellowshifts/database/public';
export type Preferences = { arrival: boolean; exit: boolean };
export const disabled: Preferences = { arrival: false, exit: false };
export const DEDUPE_MS = 2 * 3600000;
export const LEASE_MS = 24 * 3600000;
export const REGION_LIMIT = 20;
export type Registry = { userId: string; expires: number; signature: string; stations: string[]; dedupe: Record<string, number> };
export function preferences(value: unknown): Preferences {
  const p = value as Partial<Preferences> | null;
  return { arrival: p?.arrival === true, exit: p?.exit === true };
}
export function rankedRegions(context: ReminderContext, current: string | undefined, prefs: Preferences) {
  return context.stations.filter(s => (prefs.exit && s.id === context.activeStation) || (prefs.arrival && (s.id === current || s.nextStart !== null)))
    .sort((a,b) => Number(b.id === context.activeStation) - Number(a.id === context.activeStation) || (a.nextStart ?? Infinity) - (b.nextStart ?? Infinity) || Number(b.id === current) - Number(a.id === current) || a.id.localeCompare(b.id))
    .slice(0, REGION_LIMIT).map(s => ({identifier: s.id, latitude: s.latitude, longitude: s.longitude, radius: s.radius, notifyOnEnter: prefs.arrival, notifyOnExit: prefs.exit}));
}
export function shouldRemind(context: ReminderContext, registry: Registry, userId: string, stationId: string, kind: 'arrival' | 'exit', prefs: Preferences, now: number) {
  if (registry.userId !== userId || registry.expires <= now || !prefs[kind] || !registry.stations.includes(stationId)) return false;
  const station = context.stations.find(s => s.id === stationId);
  if (!station) return false;
  const last = registry.dedupe[`${kind}:${stationId}`];
  if (last !== undefined && (now < last || now - last < DEDUPE_MS)) return false;
  return kind === 'exit' ? context.activeStation === stationId : station.arrivalRelevant && context.activeStation === null;
}
