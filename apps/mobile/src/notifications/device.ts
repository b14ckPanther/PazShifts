import * as Crypto from 'expo-crypto';
import { registerWorkerDevice } from '@yellowshifts/database/public';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
const installationKey = 'ys.notifications.installation.v1';
let installationPromise: Promise<{ id: string; secret: string }> | null = null;
async function installation() {
  if (!installationPromise)
    installationPromise = (async () => {
      const saved = await SecureStore.getItemAsync(installationKey);
      if (saved) {
        const value = JSON.parse(saved);
        if (
          typeof value.id === 'string' &&
          typeof value.secret === 'string' &&
          value.secret.length >= 64
        )
          return value;
        throw Error('Installation storage unavailable');
      }
      const value = { id: Crypto.randomUUID(), secret: Crypto.randomUUID() + Crypto.randomUUID() };
      await SecureStore.setItemAsync(installationKey, JSON.stringify(value), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      return value;
    })().catch((e) => {
      installationPromise = null;
      throw e;
    });
  return installationPromise;
}
export async function prepareNotificationChannel() {
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('work', {
      name: 'עדכוני עבודה',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
}
function bounded<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Notification setup timed out')), 10000);
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
let work: Promise<unknown> = Promise.resolve();
export function synchronizeDevice(userId: string, detach = false) {
  const run = async () => {
    if (!supabase) return;
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user || user.id !== userId) throw Error('Session unavailable');
    const saved = await SecureStore.getItemAsync(installationKey);
    if (detach && !saved) return;
    const value = await installation();
    let token: string | null = null;
    if (!detach) {
      const permission = await Notifications.getPermissionsAsync();
      if (permission.granted && Device.isDevice) {
        const projectId =
          Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) throw Error('Notifications unavailable');
        await prepareNotificationChannel();
        token = (await bounded(Notifications.getExpoPushTokenAsync({ projectId }))).data;
      }
    }
    // Serialize rotation/logout/account reassociation so an old request cannot run after detach.
    await registerWorkerDevice(supabase, {
      p_installation: value.id,
      p_secret: value.secret,
      p_token: token,
      p_platform: Platform.OS,
      p_version: Constants.expoConfig?.version || null,
    });
    if (detach) await Notifications.dismissAllNotificationsAsync();
  };
  const result = work.then(run, run);
  work = result.catch(() => {});
  return result;
}
