import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { validateStationInterest } from '@yellowshifts/database/public';
import type { SupabaseClient } from '@supabase/supabase-js';
type Env = Record<string, string | undefined>;
const reply = (status: number, body: object) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '3600' } : {}) },
  });
async function boundedJson(request: Request) {
  if (!request.body) throw Error('Missing body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw Error('Too large');
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    reader.releaseLock();
  }
}
export async function handleStationInterest(
  request: Request,
  db: SupabaseClient,
  env: Env,
  transport: typeof fetch = fetch
) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply(415, { error: 'invalid' });
  // Only trust the header overwritten by Vercel's edge, never a client-provided IP.
  const ip =
    env.VERCEL === '1'
      ? request.headers.get('x-forwarded-for')?.trim()
      : env.NODE_ENV === 'development'
        ? '127.0.0.1'
        : undefined;
  if (
    !ip ||
    !isIP(ip) ||
    !env.STATION_LEADS_RATE_SECRET ||
    env.STATION_LEADS_RATE_SECRET.length < 32
  )
    return reply(503, { error: 'unavailable' });
  let body;
  try {
    body = await boundedJson(request);
  } catch {
    return reply(400, { error: 'invalid' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return reply(400, { error: 'invalid' });
  const allowed = [
    'full_name',
    'phone',
    'email',
    'station_name_or_number',
    'city',
    'role',
    'notes',
    'request_id',
    'platform',
    'app_version',
  ];
  if (
    Object.keys(body).some((k) => !allowed.includes(k)) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      body.request_id ?? ''
    ) ||
    !['ios', 'android'].includes(body.platform) ||
    typeof body.app_version !== 'string' ||
    !/^[\w.+-]{1,40}$/.test(body.app_version)
  )
    return reply(400, { error: 'invalid' });
  const parsed = validateStationInterest(body);
  if (!parsed.ok) return reply(400, { error: 'invalid', fields: parsed.errors });
  const ipHash = createHmac('sha256', env.STATION_LEADS_RATE_SECRET).update(ip).digest('hex');
  try {
    const { data, error } = await db.rpc('submit_station_interest', {
      p_request_id: body.request_id,
      p_ip_hash: ipHash,
      p_lead: { ...parsed.value, platform: body.platform, app_version: body.app_version },
    });
    if (error || !data) return reply(503, { error: 'unavailable' });
    if (data.result === 'limited') return reply(429, { error: 'limited' });
    if (!['created', 'duplicate'].includes(data.result))
      return reply(503, { error: 'unavailable' });
    if (
      data.result === 'created' &&
      env.RESEND_API_KEY &&
      env.STATION_LEADS_EMAIL &&
      env.STATION_LEADS_FROM
    ) {
      let sent = false;
      try {
        const response = await transport('https://api.resend.com/emails', {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `station-interest/${data.id}`,
          },
          body: JSON.stringify({
            from: env.STATION_LEADS_FROM,
            to: [env.STATION_LEADS_EMAIL],
            subject: 'YellowShifts — פנייה חדשה מתחנה',
            text: Object.entries(parsed.value)
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n'),
          }),
        });
        sent = response.ok;
      } catch {
        /* The stored lead survives provider failure; no PII in logs. */
      }
      await db
        .from('station_interest_leads')
        .update({ email_status: sent ? 'sent' : 'failed' })
        .eq('id', data.id);
    }
    // Do not reveal IDs, existing leads, email delivery state, or contact data publicly.
    return reply(202, { accepted: true });
  } catch {
    return reply(503, { error: 'unavailable' });
  }
}
