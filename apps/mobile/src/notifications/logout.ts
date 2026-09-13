let cleanup: (() => Promise<void>) | null = null;
export function setNotificationLogout(fn: (() => Promise<void>) | null) {
  cleanup = fn;
}
export async function detachNotificationsBeforeLogout() {
  if (!cleanup) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Notification cleanup timed out')), 8000);
    cleanup!()
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}
