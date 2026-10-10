import type { SupabaseClient } from '@supabase/supabase-js';
type WebDelivery = {
  id: string;
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  notificationId: string;
  type: string;
  title: string;
  body: string;
  url: string;
};
export type WebPushSend = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: { TTL: number; urgency: 'normal' | 'high'; timeout: number }
) => Promise<unknown>;
// Same allow-list as the subscriptions table: never POST to an arbitrary host.
const PUSH_HOST =
  /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;
// Time-critical alerts wake the device; the rest may wait for the next opportunity.
const URGENT = new Set(['SHIFT_SOON', 'CHECKOUT_REMINDER', 'SHIFT_CAPPED']);
const TTL: Record<string, number> = { SHIFT_SOON: 900, SHIFT_TODAY: 5400, CHECKOUT_REMINDER: 3600 };
export async function dispatchWebPush(db: SupabaseClient, send: WebPushSend) {
  async function update(id: string, values: Record<string, unknown>) {
    const { error } = await db
      .from('worker_web_push_deliveries')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw Error('Web delivery ledger unavailable');
  }
  const { data, error } = await db.rpc('claim_worker_web_push');
  if (error) throw Error('Web queue unavailable');
  const deliveries = data as WebDelivery[];
  const result = { claimed: deliveries.length, sent: 0, failed: 0, retry: 0, uncertain: 0 };
  async function deliver(d: WebDelivery) {
    if (!PUSH_HOST.test(d.endpoint)) {
      result.failed++;
      return update(d.id, { state: 'failed', error_code: 'InvalidEndpoint' });
    }
    try {
      await send(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        JSON.stringify({
          title: d.title,
          body: d.body,
          url: d.url,
          tag: d.notificationId,
          type: d.type,
        }),
        { TTL: TTL[d.type] ?? 6 * 3600, urgency: URGENT.has(d.type) ? 'high' : 'normal', timeout: 10000 }
      );
      result.sent++;
      return update(d.id, { state: 'sent', error_code: null });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // The browser dropped this subscription; stop sending to it.
        const { error: cleanup } = await db
          .from('worker_web_push_subscriptions')
          .delete()
          .eq('id', d.subscriptionId)
          .eq('endpoint', d.endpoint);
        if (cleanup) throw Error('Subscription cleanup unavailable', { cause: e });
        result.failed++;
        return update(d.id, { state: 'failed', error_code: 'Gone' });
      }
      if (status === 429 || (status && status >= 500)) {
        result.retry++;
        return update(d.id, {
          state: 'pending',
          next_attempt_at: new Date(Date.now() + 5 * 60000).toISOString(),
          error_code: `HTTP${status}`,
        });
      }
      if (status) {
        result.failed++;
        return update(d.id, { state: 'failed', error_code: `HTTP${status}` });
      }
      // No response: the push service may have accepted it, so never resend.
      result.uncertain++;
      return update(d.id, { state: 'uncertain', error_code: 'TransportUncertain' });
    }
  }
  for (let i = 0; i < deliveries.length; i += 10)
    await Promise.all(deliveries.slice(i, i + 10).map(deliver));
  return result;
}
