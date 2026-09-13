import type { SupabaseClient } from '@supabase/supabase-js';
import { getNativeWorkerContext } from './worker-context';
import { validDate } from '@yellowshifts/reports';
export type WorkerNotification = {
  id: string;
  user_id: string;
  station_id: string;
  type: 'SCHEDULE_PUBLISHED' | 'SHIFT_REMINDER';
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  data: { stationName?: string; day?: string; shiftId?: string; scheduleId?: string };
};
export type NotificationPreferences = {
  schedule_published: boolean;
  reminder_minutes: 0 | 30 | 60;
};
export const notificationId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function readWorkerInbox(client: SupabaseClient, page = 0) {
  if (!Number.isInteger(page) || page < 0 || page > 1000) throw Error('Invalid page');
  const { data, error } = await client
    .from('worker_notifications')
    .select('id,user_id,station_id,type,title,body,created_at,read_at,data')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(page * 30, page * 30 + 29);
  if (error) throw Error('Inbox unavailable');
  return data as WorkerNotification[];
}
export async function unreadWorkerNotifications(client: SupabaseClient) {
  const { count, error } = await client
    .from('worker_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw Error('Inbox unavailable');
  return count || 0;
}
export async function markWorkerNotificationsRead(client: SupabaseClient, id?: string) {
  if (id && !notificationId(id)) throw Error('Invalid notification');
  const { error } = await client.rpc('mark_worker_notifications_read', { p_id: id || null });
  if (error) throw Error('Inbox unavailable');
}
export async function workerNotificationTarget(
  client: SupabaseClient,
  id: string,
  expectedUser: string
) {
  if (!notificationId(id)) throw Error('Invalid notification');
  const context = await getNativeWorkerContext(client, expectedUser);
  const { data, error } = await client
    .from('worker_notifications')
    .select('station_id,data,type')
    .eq('id', id)
    .eq('user_id', context.userId)
    .single();
  if (
    error ||
    !data ||
    !context.stations.some((s) => s.id === data.station_id) ||
    !validDate(data.data?.day)
  )
    throw Error('Destination unavailable');
  if (!['SCHEDULE_PUBLISHED', 'SHIFT_REMINDER'].includes(data.type))
    throw Error('Destination unavailable');
  if (!notificationId(data.data.scheduleId)) throw Error('Destination unavailable');
  const schedule = await client
    .from('schedules')
    .select('id')
    .eq('id', data.data.scheduleId)
    .eq('station_id', data.station_id)
    .eq('status', 'PUBLISHED')
    .maybeSingle();
  if (schedule.error || !schedule.data) throw Error('Destination unavailable');
  if (data.type === 'SHIFT_REMINDER') {
    if (!notificationId(data.data.shiftId)) throw Error('Destination unavailable');
    const membership = context.stations.find((s) => s.id === data.station_id)!;
    const assignment = await client
      .from('shift_assignments')
      .select('id')
      .eq('scheduled_shift_id', data.data.shiftId)
      .eq('station_membership_id', membership.membershipId)
      .eq('status', 'ASSIGNED')
      .maybeSingle();
    if (assignment.error || !assignment.data) throw Error('Destination unavailable');
  }
  return { stationId: data.station_id as string, day: data.data.day as string };
}
export async function workerNotificationPreferences(
  client: SupabaseClient,
  userId: string,
  value?: NotificationPreferences
): Promise<NotificationPreferences> {
  if (value) {
    const { error } = await client
      .from('worker_notification_preferences')
      .upsert({ user_id: userId, ...value });
    if (error) throw Error('Preferences unavailable');
    return value;
  }
  const { data, error } = await client
    .from('worker_notification_preferences')
    .select('schedule_published,reminder_minutes')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw Error('Preferences unavailable');
  return data || { schedule_published: true, reminder_minutes: 60 };
}
export async function registerWorkerDevice(
  client: SupabaseClient,
  args: {
    p_installation: string;
    p_secret: string;
    p_token: string | null;
    p_platform: string;
    p_version: string | null;
  }
) {
  const { data, error } = await client.rpc('register_worker_device', args);
  if (error) throw Error('Device registration unavailable');
  return data as string | null;
}
