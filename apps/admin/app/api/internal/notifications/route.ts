import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotifications } from '../../lib/notification-delivery';
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
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await dispatchNotifications(client, process.env.EXPO_ACCESS_TOKEN);
    console.info('worker_notifications', result);
    return Response.json(result);
  } catch {
    console.error('worker_notifications_failed');
    return new Response('Delivery unavailable', { status: 503 });
  }
}
