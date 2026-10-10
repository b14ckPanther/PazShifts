'use server';

import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@yellowshifts/database';

type Subscription = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

// Mirrors the table checks; the database is still the authority.
const PUSH_HOST =
  /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

// These RPCs are newer than the generated database types.
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> };
async function client() {
  return createServerSupabaseClient(await cookies()) as unknown as RpcClient;
}

/** Saves this browser's push subscription for the signed-in worker. */
export async function savePushSubscriptionAction(
  subscription: Subscription,
  userAgent?: string
): Promise<{ ok: boolean }> {
  const { endpoint, keys } = subscription ?? {};
  if (
    typeof endpoint !== 'string' ||
    endpoint.length > 1024 ||
    !PUSH_HOST.test(endpoint) ||
    typeof keys?.p256dh !== 'string' ||
    typeof keys?.auth !== 'string'
  )
    return { ok: false };
  const { error } = await (await client()).rpc('register_web_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 300) : null,
  });
  return { ok: !error };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<{ ok: boolean }> {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return { ok: false };
  const { error } = await (await client()).rpc('unregister_web_push_subscription', {
    p_endpoint: endpoint,
  });
  return { ok: !error };
}
