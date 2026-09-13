import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Inbox, InboxApi } from '../../app/inbox';
import { NotificationContext } from '../../src/notifications/Provider';
import { NotificationBell } from '../../src/notifications/UI';
import { Button } from '../../src/ui';
import type { WorkerNotification } from '@yellowshifts/database/public';
export default function NotificationsPreview() {
  const [width, setWidth] = useState(320),
    [mode, setMode] = useState('mixed'),
    [unread, setUnread] = useState(12),
    [permission, setPermission] = useState('undetermined');
  const [prefs, setPrefs] = useState<{
    schedule_published: boolean;
    reminder_minutes: 0 | 30 | 60;
  }>({ schedule_published: true, reminder_minutes: 60 });
  const rows: WorkerNotification[] =
    mode === 'empty'
      ? []
      : Array.from({ length: 3 }, (_, i) => ({
          id: `fixture-${i}`,
          user_id: 'fixture',
          station_id: 'fixture',
          type: i === 1 ? 'SHIFT_REMINDER' : 'SCHEDULE_PUBLISHED',
          title: i === 1 ? 'המשמרת שלך מתקרבת' : 'סידור העבודה החדש מוכן לצפייה',
          body:
            i === 2
              ? 'סידור העבודה שלך מוכן. אפשר לבדוק את הימים הקרובים ולהתכונן לשבוע הבא בקצב שלך.'
              : 'כל הפרטים מחכים לך בתוך האפליקציה.',
          created_at: '2026-09-13T09:30:00Z',
          read_at: i === 2 ? '2026-09-13T09:31:00Z' : null,
          data: {},
        }));
  return (
    <NotificationContext.Provider
      value={{
        enabled: true,
        unread,
        permission,
        ask: permission === 'undetermined',
        error: false,
        banner: false,
        prefs,
        target: null,
        consume: () => {},
        refresh: async () => {},
        enable: async () => setPermission('granted'),
        later: async () => setPermission('later'),
        save: async (p) => setPrefs(p),
        open: async () => {},
      }}
    >
      <View style={{ flex: 1, paddingTop: 60, alignItems: 'center', backgroundColor: '#ececec' }}>
        <ScrollView horizontal style={{ maxHeight: 65 }}>
          <Button
            title={String(width)}
            onPress={() => setWidth(width === 320 ? 390 : width === 390 ? 430 : 320)}
          />
          <Button title={mode} onPress={() => setMode(mode === 'mixed' ? 'empty' : 'mixed')} />
          <Button
            title={permission}
            onPress={() => setPermission(permission === 'denied' ? 'undetermined' : 'denied')}
          />
          <Button
            title={String(unread)}
            onPress={() => setUnread(unread === 12 ? 1 : unread === 1 ? 0 : 12)}
          />
        </ScrollView>
        <View style={{ width, flex: 1 }}>
          <NotificationBell />
          <InboxApi.Provider value={{ read: async () => rows, mark: async () => setUnread(0) }}>
            <Inbox key={mode} />
          </InboxApi.Provider>
        </View>
      </View>
    </NotificationContext.Provider>
  );
}
