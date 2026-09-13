import type { SupabaseClient } from '@supabase/supabase-js';
type Delivery = {
  id: string;
  token: string;
  notificationId: string;
  userId: string;
  title: string;
  body: string;
};
type Ticket = { status: string; id?: string; details?: { error?: string } };
const code = (value?: string) =>
  [
    'DeviceNotRegistered',
    'MessageRateExceeded',
    'MessageTooBig',
    'InvalidCredentials',
    'MismatchSenderId',
  ].includes(value || '')
    ? value!
    : 'ProviderError';
export async function dispatchNotifications(
  db: SupabaseClient,
  accessToken?: string,
  transport: typeof fetch = fetch
) {
  async function request(path: string, body: unknown) {
    return transport(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  }
  async function update(id: string, values: Record<string, unknown>) {
    const { error } = await db
      .from('worker_notification_deliveries')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw Error('Delivery ledger unavailable');
  }
  // Receipts are retried independently; they can never resend a notification.
  const { data: pending, error: receiptReadError } = await db
    .from('worker_notification_deliveries')
    .select('id,ticket_id,device_id,token_snapshot,updated_at')
    .eq('state', 'ticket')
    .lt('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at')
    .limit(100);
  if (receiptReadError) throw Error('Receipt ledger unavailable');
  if (pending?.length) {
    let receipts: Record<string, Ticket> | undefined;
    try {
      const response = await request('getReceipts', { ids: pending.map((r) => r.ticket_id) });
      if (response.ok) receipts = (await response.json()).data;
    } catch {
      /* Provider outage must not starve fresh sends. */
    }
    for (const row of pending) {
      const receipt = receipts?.[row.ticket_id];
      if (!receipt || !['ok', 'error'].includes(receipt.status)) {
        if (Date.parse(row.updated_at) < Date.now() - 23 * 3600000) {
          await update(row.id, { state: 'uncertain', error_code: 'ReceiptMissing' });
        } else {
          // Preserve the original ticket timestamp for the 23-hour deadline.
          const { error } = await db
            .from('worker_notification_deliveries')
            .update({
              next_attempt_at: new Date(Date.now() + 15 * 60000).toISOString(),
              error_code: 'ReceiptPending',
            })
            .eq('id', row.id);
          if (error) throw Error('Receipt ledger unavailable');
        }
        continue;
      }
      if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
        const { error } = await db
          .from('worker_devices')
          .update({ notifications_enabled: false })
          .eq('id', row.device_id)
          .eq('expo_push_token', row.token_snapshot);
        if (error) throw Error('Device cleanup unavailable');
      }
      await update(row.id, {
        state: receipt.status === 'ok' ? 'delivered' : 'failed',
        error_code: receipt.status === 'ok' ? null : code(receipt.details?.error),
      });
    }
  }
  const { data, error } = await db.rpc('claim_worker_notifications');
  if (error) throw Error('Queue unavailable');
  const deliveries = data as Delivery[];
  if (!deliveries.length) return { claimed: 0 };
  let response: Response;
  try {
    response = await request(
      'send',
      deliveries.map((d) => ({
        to: d.token,
        title: d.title,
        body: d.body,
        data: { notificationId: d.notificationId, userId: d.userId },
        sound: 'default',
        channelId: 'work',
        ttl: 300,
      }))
    );
  } catch {
    for (const d of deliveries)
      await update(d.id, { state: 'uncertain', error_code: 'TransportUncertain' });
    return { claimed: deliveries.length, uncertain: deliveries.length };
  }
  if (!response.ok) {
    // Explicit rejection may retry; ambiguous 5xx must not produce a duplicate accepted push.
    for (const d of deliveries)
      await update(d.id, {
        state:
          response.status === 429 ? 'pending' : response.status >= 500 ? 'uncertain' : 'failed',
        next_attempt_at: new Date(Date.now() + 5 * 60000).toISOString(),
        error_code: `HTTP${response.status}`,
      });
    return { claimed: deliveries.length, rejected: deliveries.length };
  }
  let tickets: Ticket[];
  try {
    const body = await response.json();
    if (!Array.isArray(body.data) || body.data.length !== deliveries.length) throw Error();
    tickets = body.data;
  } catch {
    for (const d of deliveries)
      await update(d.id, { state: 'uncertain', error_code: 'InvalidResponse' });
    return { claimed: deliveries.length, uncertain: deliveries.length };
  }
  for (let i = 0; i < deliveries.length; i++) {
    const d = deliveries[i]!,
      t = tickets[i]!;
    if (t.status === 'ok' && typeof t.id === 'string')
      await update(d.id, {
        state: 'ticket',
        ticket_id: t.id,
        next_attempt_at: new Date(Date.now() + 15 * 60000).toISOString(),
      });
    else {
      const errorCode = code(t.details?.error);
      if (errorCode === 'DeviceNotRegistered') {
        const { error } = await db
          .from('worker_devices')
          .update({ notifications_enabled: false })
          .eq('expo_push_token', d.token);
        if (error) throw Error('Device cleanup unavailable');
      }
      await update(d.id, {
        state: errorCode === 'MessageRateExceeded' ? 'pending' : 'failed',
        next_attempt_at: new Date(Date.now() + 5 * 60000).toISOString(),
        error_code: errorCode,
      });
    }
  }
  return { claimed: deliveries.length };
}
