import { createSecureStorage } from '../auth/secure-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getWorkerReminderContext } from '@yellowshifts/database/public';
import { supabase } from '../lib/supabase';
import { prepareNotificationChannel } from '../notifications/device';
import {
  preferences,
  rankedRegions,
  shouldRemind,
  LEASE_MS,
  DEDUPE_MS,
  type Preferences,
  type Registry,
} from './model';
export const TASK = 'yellowshifts-station-reminders-v1';
const KEY = 'location.registry.v1';
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const registryStorage = createSecureStorage({
  getItemAsync: SecureStore.getItemAsync,
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
  deleteItemAsync: SecureStore.deleteItemAsync,
});
let queue: Promise<unknown> = Promise.resolve();
let generation = 0;
export const serial = <T>(action: () => Promise<T>): Promise<T> => {
  const result = queue.then(action, action);
  queue = result.catch(() => {});
  return result;
};
export function diagnostic(result: string, count?: number) {
  if (__DEV__) console.info('[location-reminders]', result, count ?? '');
}
async function read(key: string): Promise<unknown> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function registry(): Promise<Registry | null> {
  const raw = await registryStorage.getItem(KEY);
  let v: Registry | null;
  try {
    v = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  return v &&
    typeof v.userId === 'string' &&
    Number.isFinite(v.expires) &&
    typeof v.signature === 'string' &&
    Array.isArray(v.stations) &&
    v.stations.every((s) => typeof s === 'string') &&
    v.dedupe &&
    typeof v.dedupe === 'object'
    ? v
    : null;
}
export const getPreferences = async (user: string) =>
  preferences(await read(`location.prefs.${user}`));
export async function permissionState(): Promise<string> {
  const [fg, bg, n, services, available] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Notifications.getPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
    TaskManager.isAvailableAsync(),
  ]);
  if (!available) return 'unavailable';
  if (!services) return 'services';
  if (!n.granted) return 'notifications';
  if (!fg.granted) return 'foreground';
  if (
    (Platform.OS === 'ios' && fg.ios?.accuracy !== 'full') ||
    (Platform.OS === 'android' && fg.android?.accuracy !== 'fine')
  )
    return 'precise';
  if (!bg.granted) return 'background';
  return 'ready';
}
/** Called only after the explanatory sheet's explicit enable action. */
export async function requestReminderPermissions(confirmBackground: () => Promise<boolean>) {
  await prepareNotificationChannel();
  if (!(await Notifications.getPermissionsAsync()).granted)
    await Notifications.requestPermissionsAsync();
  if (!(await Notifications.getPermissionsAsync()).granted) return 'notifications';
  if (!(await Location.getForegroundPermissionsAsync()).granted)
    await Location.requestForegroundPermissionsAsync();
  const state = await permissionState();
  // Do not request stronger permissions when notifications/location/precision are unavailable.
  if (state !== 'background') return state;
  if (await confirmBackground()) await Location.requestBackgroundPermissionsAsync();
  return permissionState();
}
async function stop() {
  // Attempt every cleanup even if keychain/native notification access fails independently.
  const results = await Promise.allSettled([
    (async () => {
      let value: string | null;
      try {
        value = await registryStorage.getItem(KEY);
      } catch {
        await registryStorage.removeItem(KEY);
        return;
      }
      if (value) await registryStorage.removeItem(KEY);
    })(),
    (async () => {
      if (await Location.hasStartedGeofencingAsync(TASK)) await Location.stopGeofencingAsync(TASK);
    })(),
    (async () => {
      for (const notification of await Notifications.getAllScheduledNotificationsAsync()) {
        if (notification.content.data?.kind === 'location-reminder')
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
      for (const notification of await Notifications.getPresentedNotificationsAsync()) {
        if (notification.request.content.data?.kind === 'location-reminder')
          await Notifications.dismissNotificationAsync(notification.request.identifier);
      }
    })(),
  ]);
  if (results.some((r) => r.status === 'rejected')) throw Error('Reminder cleanup unavailable');
}
export function clearLocationReminders() {
  generation++;
  return serial(stop);
}
export async function savePreferences(user: string, next: Preferences) {
  generation++;
  await serial(async () => {
    await stop();
    await SecureStore.setItemAsync(
      `location.prefs.${user}`,
      JSON.stringify(preferences(next)),
      options
    );
  });
}
export function reconcileWorkerGeofences(user: string, current?: string) {
  const run = generation;
  return serial(async () => {
    try {
      if (run !== generation) return;
      const old = await registry();
      if (old && old.userId !== user) await stop();
      const prefs = await getPreferences(user);
      if ((!prefs.arrival && !prefs.exit) || (await permissionState()) !== 'ready' || !supabase) {
        await stop();
        return;
      }
      const context = await getWorkerReminderContext(supabase, user);
      if (run !== generation) return;
      const regions = rankedRegions(context, current, prefs);
      if (!regions.length) {
        await stop();
        diagnostic('no-eligible-stations');
        return;
      }
      const signature = JSON.stringify(regions);
      const unchanged =
        old?.userId === user &&
        old.signature === signature &&
        (await Location.hasStartedGeofencingAsync(TASK));
      // Persist before registration: initial OS region-state callbacks still require fresh authorization.
      await registryStorage.setItem(
        KEY,
        JSON.stringify({
          userId: user,
          expires: Date.now() + LEASE_MS,
          signature,
          stations: regions.map((r) => r.identifier),
          dedupe: old?.userId === user ? old.dedupe : {},
        } satisfies Registry)
      );
      if (!unchanged) await Location.startGeofencingAsync(TASK, regions);
      diagnostic('reconciled', regions.length);
    } catch {
      await stop().catch(() => {});
      diagnostic('reconciliation-unavailable');
    }
  });
}
export function handleGeofence(station: string, kind: 'arrival' | 'exit') {
  const run = generation;
  return serial(async () => {
    try {
      const state = await registry();
      if (!state || state.expires <= Date.now() || !supabase) {
        await stop();
        return;
      }
      if ((await permissionState()) !== 'ready') {
        await stop();
        return;
      }
      const prefs = await getPreferences(state.userId);
      const last = state.dedupe[`${kind}:${station}`];
      if (
        !prefs[kind] ||
        !state.stations.includes(station) ||
        (last !== undefined && Date.now() - last < DEDUPE_MS)
      ) {
        diagnostic('duplicate-or-disabled');
        return;
      }

      // This performs auth.getUser + fresh active membership checks. Offline => skip, never use stale ACTIVE.
      const context = await getWorkerReminderContext(supabase, state.userId);
      const registered = JSON.parse(state.signature) as Location.LocationRegion[];
      const previous = Array.isArray(registered)
        ? registered.find((r) => r.identifier === station)
        : null;
      const fresh = context.stations.find((s) => s.id === station);
      if (
        !previous ||
        !fresh ||
        previous.latitude !== fresh.latitude ||
        previous.longitude !== fresh.longitude ||
        previous.radius !== fresh.radius
      ) {
        await stop();
        diagnostic('station-configuration-changed');
        return;
      }

      if (
        run !== generation ||
        !shouldRemind(context, state, state.userId, station, kind, prefs, Date.now())
      ) {
        diagnostic('reminder-skipped');
        return;
      }
      // Claim before scheduling: ambiguous native failures suppress retries instead of producing duplicates.
      state.dedupe[`${kind}:${station}`] = Date.now();
      await registryStorage.setItem(KEY, JSON.stringify(state));
      if (run !== generation) return;
      await prepareNotificationChannel();
      if (run !== generation) return;
      await Notifications.scheduleNotificationAsync({
        identifier: `location-${state.userId}-${station}-${kind}`,
        content: {
          title: kind === 'arrival' ? 'הגעת לתחנה' : 'נראה שעזבת את התחנה',
          body:
            kind === 'arrival'
              ? 'אל תשכח לסרוק את תג ה-NFC כדי להתחיל את המשמרת.'
              : 'יש לך משמרת פעילה. אם סיימת, אל תשכח לסרוק שוב את תג ה-NFC.',
          data: {
            kind: 'location-reminder',
            userId: state.userId,
            stationId: station,
            createdAt: Date.now(),
          },
        },
        trigger: Platform.OS === 'android' ? { channelId: 'work' } : null,
      });
      diagnostic('reminder-scheduled');
    } catch {
      diagnostic('reminder-unavailable');
    }
  });
}
