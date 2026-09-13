/** Explicit native/browser boundary. Never export server/client factories here. */
export { normalizePhone, passwordCredentials } from './src/login-identifier';
export type { Database } from '@yellowshifts/types';
export { getNativeWorkerContext, type WorkerContext } from './src/worker-context';
export { getMobileHome, type MobileHome, type MobileShift } from './src/mobile-home';
export {
  getMobileWorkerSchedule,
  getMobileAvailabilityWeek,
  saveMobileAvailability,
  type NativeShift,
  type NativeSchedule,
} from './src/mobile-week';
export {
  getMobileWorkerHours,
  hoursRange,
  HoursScopeError,
  type MobileHours,
  type HoursPeriod,
} from './src/mobile-hours';
export {
  readWorkerInbox,
  unreadWorkerNotifications,
  markWorkerNotificationsRead,
  workerNotificationTarget,
  workerNotificationPreferences,
  notificationId,
  type WorkerNotification,
  type NotificationPreferences,
} from './src/mobile-notifications';
export { registerWorkerDevice } from './src/mobile-notifications';

export {
  getWorkerReminderContext,
  type ReminderStation,
  type ReminderContext,
} from './src/mobile-location';
