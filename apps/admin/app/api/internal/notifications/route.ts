import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from 'web-push';
import { dispatchNotifications } from '../../lib/notification-delivery';
import { dispatchWebPush } from '../../lib/web-push-delivery';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.NOTIFICATIONS_CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return new Response('Unauthorized', { status: 401 });
  if (process.env.NOTIFICATIONS_ENABLED !== 'true') return Response.json({ enabled: false });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response('Unavailable', { status: 503 });
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The Expo pass also generates due notifications and runs the 12-hour cap; Web Push follows.
  // Each channel fails independently so one provider outage never starves the other.
  const result: Record<string, unknown> = {};
  let failures = 0;
  try {
    result.expo = await dispatchNotifications(client, process.env.EXPO_ACCESS_TOKEN);
  } catch {
    failures++;
    console.error('worker_notifications_failed');
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY,
    privateKey = process.env.VAPID_PRIVATE_KEY,
    subject = process.env.VAPID_SUBJECT;
  if (publicKey && privateKey && subject) {
    try {
      result.web = await dispatchWebPush(client, (subscription, payload, options) =>
        sendNotification(subscription, payload, {
          ...options,
          vapidDetails: { subject, publicKey, privateKey },
        })
      );
    } catch {
      failures++;
      console.error('worker_web_push_failed');
    }
  }
  console.info('worker_notifications', result);
  if (failures && !Object.keys(result).length)
    return new Response('Delivery unavailable', { status: 503 });
  return Response.json(result);
}
