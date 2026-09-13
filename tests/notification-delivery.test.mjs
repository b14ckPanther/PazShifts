import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript'),
  exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../apps/admin/app/api/lib/notification-delivery.ts', import.meta.url),
      'utf8'
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  { exports, fetch, AbortSignal, Date, Error }
);
const delivery = {
  id: 'd',
  token: 'ExpoPushToken[fixture]',
  notificationId: 'n',
  userId: 'u',
  title: 'title',
  body: 'body',
};
function database({ pending = [], claim = [delivery], failUpdate = false } = {}) {
  const writes = [];
  return {
    writes,
    from(table) {
      let values;
      const query = {
        select() {
          return query;
        },
        update(v) {
          values = v;
          return query;
        },
        eq() {
          return query;
        },
        lt() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        then(resolve) {
          if (values) writes.push({ table, ...values });
          return Promise.resolve({
            data: values ? null : pending,
            error: values && failUpdate ? {} : null,
          }).then(resolve);
        },
      };
      return query;
    },
    async rpc() {
      return { data: claim, error: null };
    },
  };
}
const response = (data, status = 200) => new Response(JSON.stringify({ data }), { status });
test('accepted tickets are recorded once with minimal routing payload', async () => {
  const db = database();
  let calls = 0;
  await exports.dispatchNotifications(db, undefined, async (url, init) => {
    calls++;
    const body = JSON.parse(init.body);
    assert.deepEqual(body[0].data, { notificationId: 'n', userId: 'u' });
    assert.equal(body.length, 1);
    return response([{ status: 'ok', id: 'ticket' }]);
  });
  assert.equal(calls, 1);
  assert.equal(db.writes[0].state, 'ticket');
});
test('ambiguous network failure is uncertain, never an automatic duplicate', async () => {
  const db = database();
  let calls = 0;
  await exports.dispatchNotifications(db, undefined, async () => {
    calls++;
    throw Error('offline');
  });
  assert.equal(calls, 1);
  assert.equal(db.writes[0].state, 'uncertain');
});
for (const status of [429, 500, 401])
  test(`HTTP ${status} has explicit retry policy`, async () => {
    const db = database();
    await exports.dispatchNotifications(db, undefined, async () => response(null, status));
    assert.equal(
      db.writes[0].state,
      status === 429 ? 'pending' : status === 500 ? 'uncertain' : 'failed'
    );
  });
test('invalid device ticket deactivates token', async () => {
  const db = database();
  await exports.dispatchNotifications(db, undefined, async () =>
    response([{ status: 'error', details: { error: 'DeviceNotRegistered' } }])
  );
  assert.equal(db.writes[0].table, 'worker_devices');
  assert.equal(db.writes[0].notifications_enabled, false);
  assert.equal(db.writes[1].state, 'failed');
});
test('invalid device receipt deactivates exact installation and cannot resend', async () => {
  const db = database({
    pending: [
      {
        id: 'd',
        ticket_id: 't',
        device_id: 'device',
        token_snapshot: delivery.token,
        updated_at: new Date(Date.now() - 20 * 60000).toISOString(),
      },
    ],
    claim: [],
  });
  let calls = 0;
  await exports.dispatchNotifications(db, undefined, async (url) => {
    calls++;
    assert.match(url, /getReceipts$/);
    return response({ t: { status: 'error', details: { error: 'DeviceNotRegistered' } } });
  });
  assert.equal(calls, 1);
  assert.equal(db.writes[0].notifications_enabled, false);
});
test('corrupt response cannot trigger a retry of potentially accepted messages', async () => {
  const db = database();
  await exports.dispatchNotifications(db, undefined, async () => response([]));
  assert.equal(db.writes[0].state, 'uncertain');
});
test('ledger failure does not rerun a successful send', async () => {
  const db = database({ failUpdate: true });
  let calls = 0;
  await assert.rejects(
    exports.dispatchNotifications(db, undefined, async () => {
      calls++;
      return response([{ status: 'ok', id: 't' }]);
    })
  );
  assert.equal(calls, 1);
});
test('receipt outage backs off without starving new sends or resetting expiry', async () => {
  const db = database({
    pending: [{ id: 'receipt', ticket_id: 't', updated_at: new Date().toISOString() }],
  });
  let sends = 0;
  await exports.dispatchNotifications(db, undefined, async (url) => {
    if (url.endsWith('getReceipts')) throw Error('offline');
    sends++;
    return response([{ status: 'ok', id: 'new' }]);
  });
  assert.equal(sends, 1);
  assert.equal(db.writes[0].error_code, 'ReceiptPending');
  assert.equal(db.writes[0].updated_at, undefined);
});
