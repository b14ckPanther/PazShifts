import 'react-native-url-polyfill/auto';
import { createBoundedFetch } from './network';
import { createClient, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import type { Database } from '@yellowshifts/database/public';
import { createSecureStorage } from '../auth/secure-storage';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && anonKey);
const storage = createSecureStorage({
  getItemAsync: SecureStore.getItemAsync,
  setItemAsync: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      // Background reminders need authenticated RLS reads while the screen is locked.
      // Device-only keychain; unavailable before the first unlock after a reboot.
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
  deleteItemAsync: SecureStore.deleteItemAsync,
});
// Missing configuration is a visible setup state; no mock backend or secret fallback.
export const supabase = configured
  ? createClient<Database>(url!, anonKey!, {
      global: { fetch: createBoundedFetch() },
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;

/** Rewrite an existing session under the background-capable device-only keychain policy. */
export async function prepareBackgroundSession() {
  if (!url || !supabase) throw Error('Session unavailable');
  const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  const value = await storage.getItem(key);
  if (!value) throw Error('Session unavailable');
  await storage.setItem(key, value);
}
