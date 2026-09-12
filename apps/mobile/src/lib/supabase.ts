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
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
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
