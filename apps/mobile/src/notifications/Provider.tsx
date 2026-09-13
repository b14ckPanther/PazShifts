import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {
  notificationId,
  unreadWorkerNotifications,
  workerNotificationTarget,
  markWorkerNotificationsRead,
  workerNotificationPreferences,
  type NotificationPreferences,
} from '@yellowshifts/database/public';
import { useSession } from '../auth/SessionProvider';
import { supabase } from '../lib/supabase';
import { synchronizeDevice, prepareNotificationChannel } from './device';
import { setNotificationLogout } from './logout';
const enabled = process.env.EXPO_PUBLIC_NOTIFICATIONS_ENABLED === 'true';
Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: notification.request.content.data?.kind === 'location-reminder',
    shouldShowList: notification.request.content.data?.kind === 'location-reminder',
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
const pendingKey = 'ys.notification.destination.v1',
  askedKey = 'ys.notification.asked.v1';
type Target = { stationId: string; day: string; screen?: 'home' };
type Value = {
  enabled: boolean;
  unread: number;
  permission: string;
  ask: boolean;
  error: boolean;
  banner: boolean;
  prefs: NotificationPreferences | null;
  target: Target | null;
  consume: () => void;
  refresh: () => Promise<void>;
  enable: () => Promise<void>;
  later: () => Promise<void>;
  save: (p: NotificationPreferences) => Promise<void>;
  open: (id: string, revealApp?: () => void) => Promise<void>;
};
export const NotificationContext = createContext<Value | null>(null);
export const useWorkerNotifications = () => {
  const value = useContext(NotificationContext);
  if (!value) throw Error('Notifications provider required');
  return value;
};
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { state } = useSession();
  return (
    <NotificationSession key={state.phase === 'ready' ? state.context?.userId : 'signed-out'}>
      {children}
    </NotificationSession>
  );
}
function NotificationSession({ children }: { children: ReactNode }) {
  const { state } = useSession(),
    userId = state.phase === 'ready' ? state.context?.userId : null;
  const [unread, setUnread] = useState(0),
    [permission, setPermission] = useState('undetermined'),
    [ask, setAsk] = useState(false),
    [error, setError] = useState(false),
    [banner, setBanner] = useState(false),
    [prefs, setPrefs] = useState<NotificationPreferences | null>(null),
    [pending, setPending] = useState<{ id: string; user: string; at: number } | null>(null),
    [target, setTarget] = useState<Target | null>(null);
  const generation = useRef(0),
    identity = useRef(userId);
  identity.current = userId;
  const refresh = useCallback(async () => {
    if (!enabled || !supabase || !userId) return;
    const current = userId,
      run = generation.current;
    try {
      const [count, preferences, status, asked] = await Promise.all([
        unreadWorkerNotifications(supabase),
        workerNotificationPreferences(supabase, userId),
        Notifications.getPermissionsAsync(),
        SecureStore.getItemAsync(askedKey),
      ]);
      if (identity.current === current && generation.current === run) {
        setUnread(count);
        setPrefs(preferences);
        setPermission(status.status);
        setAsk(!asked && status.status === 'undetermined');
        setError(false);
      }
    } catch {
      if (identity.current === current && generation.current === run) setError(true);
    }
  }, [userId]);
  useEffect(() => {
    generation.current++;
    setUnread(0);
    setPrefs(null);
    setTarget(null);
    setBanner(false);
    setAsk(false);
    setError(false);
    if (!enabled || !userId) return;
    let alive = true;
    void refresh();
    const sync = () => {
      if (!alive) return;
      void synchronizeDevice(userId).catch(() => {
        if (alive) setError(true);
      });
    };
    sync();
    setNotificationLogout(async () => {
      alive = false;
      try {
        await synchronizeDevice(userId, true);
      } catch (e) {
        alive = true;
        throw e;
      }
      await SecureStore.deleteItemAsync(pendingKey);
      setPending(null);
    });
    const listener = Notifications.addPushTokenListener(sync);
    const foreground = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void refresh();
        sync();
      }
    });
    return () => {
      alive = false;
      listener.remove();
      foreground.remove();
      setNotificationLogout(null);
    };
  }, [userId, refresh]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const receive = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (data && notificationId(data.notificationId) && notificationId(data.userId)) {
        const next = { id: data.notificationId, user: data.userId, at: Date.now() };
        void SecureStore.setItemAsync(pendingKey, JSON.stringify(next))
          .then(() => {
            if (alive) setPending(next);
          })
          .catch(() => {});
      }
      if (data?.kind !== 'location-reminder')
        void Notifications.clearLastNotificationResponseAsync();
    };
    void SecureStore.getItemAsync(pendingKey).then((value) => {
      if (value && alive) {
        try {
          const p = JSON.parse(value);
          if (notificationId(p.id) && notificationId(p.user) && p.at > Date.now() - 86400000)
            setPending(p);
        } catch {
          /* Discard malformed local destination. */
        }
      }
    });
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r && alive) receive(r);
    });
    const response = Notifications.addNotificationResponseReceivedListener(receive);
    const incoming = Notifications.addNotificationReceivedListener((n) => {
      if (
        n.request.content.data?.kind !== 'location-reminder' &&
        n.request.content.data?.userId === identity.current
      ) {
        setBanner(true);
        void refresh();
      }
    });
    return () => {
      alive = false;
      response.remove();
      incoming.remove();
    };
  }, [refresh]);
  const open = useCallback(
    async (id: string, revealApp?: () => void) => {
      if (!supabase || !userId) return;
      const current = userId;
      try {
        const value = await workerNotificationTarget(supabase, id, userId);
        await markWorkerNotificationsRead(supabase, id);
        if (identity.current === current) {
          revealApp?.();
          setTarget(value);
          setBanner(false);
          await refresh();
        }
      } catch {
        if (identity.current === current) setError(true);
        throw Error('העדכון כבר אינו זמין לחשבון הזה.');
      }
    },
    [userId, refresh]
  );
  useEffect(() => {
    if (!pending || !userId) return;
    const p = pending;
    setPending(null);
    void SecureStore.deleteItemAsync(pendingKey);
    if (p.user === userId && p.at > Date.now() - 86400000) void open(p.id).catch(() => {});
  }, [pending, userId, open]);
  const enable = async () => {
    if (!userId) return;
    await SecureStore.setItemAsync(askedKey, 'yes');
    setAsk(false);
    await prepareNotificationChannel();
    const status = await Notifications.requestPermissionsAsync();
    setPermission(status.status);
    try {
      await synchronizeDevice(userId);
      await refresh();
    } catch {
      setError(true);
      throw Error('לא הצלחנו להפעיל התראות כרגע.');
    }
  };
  const later = async () => {
    await SecureStore.setItemAsync(askedKey, 'yes');
    setAsk(false);
  };
  const save = async (value: NotificationPreferences) => {
    if (!supabase || !userId) return;
    const current = userId;
    const result = await workerNotificationPreferences(supabase, userId, value);
    if (identity.current === current) setPrefs(result);
  };
  return (
    <NotificationContext.Provider
      value={{
        enabled,
        unread,
        permission,
        ask,
        error,
        banner,
        prefs,
        target,
        consume: () => setTarget(null),
        refresh,
        enable,
        later,
        save,
        open,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
