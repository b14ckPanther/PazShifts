import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript'),
  exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../apps/admin/app/api/lib/web-push-delivery.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  { exports, Date, Error, JSON, Promise, Set }
);
const row = (id, extra = {}) => ({
  id,
  subscriptionId: 's-' + id,
  endpoint: 'https://fcm.googleapis.com/fcm/send/' + id,
  p256dh: 'p',
  auth: 'a',
  notificationId: 'n-' + id,
  type: 'SHIFT_SOON',
  title: 'title',
  body: 'body',
  url: '/stations/X/home',
  ...extra,
});
function database(claim) {
  const writes = [];
  return {
    writes,
    rpc: async (name) => {
      assert.equal(name, 'claim_worker_web_push');
      return { data: claim, error: null };
    },
    from(table) {
      let op;
      const query = {
        update(values) {
          op = { table, kind: 'update', ...values };
          return query;
        },
        delete() {
          op = { table, kind: 'delete' };
          return query;
        },
        eq(column, value) {
          op[column] = value;
          return query;
        },
        then(resolve) {
          writes.push(op);
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}
const failure = (statusCode) => Object.assign(new Error('push'), { statusCode });

test('sends once per delivery with payload, urgency and TTL by type', async () => {
  const db = database([row('a'), row('b', { type: 'SCHEDULE_PUBLISHED' })]);
  const sent = [];
  const result = await exports.dispatchWebPush(db, async (subscription, payload, options) => {
    sent.push({ subscription, payload: JSON.parse(payload), options });
  });
  assert.equal(result.sent, 2);
  assert.deepEqual(sent[0].payload, {
    title: 'title',
    body: 'body',
    url: '/stations/X/home',
    tag: 'n-a',
    type: 'SHIFT_SOON',
  });
  assert.equal(sent[0].options.urgency, 'high');
  assert.equal(sent[0].options.TTL, 900);
  assert.equal(sent[1].options.urgency, 'normal');
  assert.deepEqual(
    db.writes.map((w) => w.state),
    ['sent', 'sent']
  );
});

test('gone subscriptions are removed; rate limits and 5xx retry; no response is never resent', async () => {
  const outcomes = { a: failure(410), b: failure(429), c: failure(503), d: failure(400), e: new Error('reset') };
  const db = database(['a', 'b', 'c', 'd', 'e'].map((id) => row(id)));
  const result = await exports.dispatchWebPush(db, async (subscription) => {
    throw outcomes[subscription.endpoint.slice(-1)];
  });
  assert.deepEqual(
    { failed: result.failed, retry: result.retry, uncertain: result.uncertain },
    { failed: 2, retry: 2, uncertain: 1 }
  );
  assert.ok(db.writes.some((w) => w.kind === 'delete' && w.id === 's-a'));
  const byId = Object.fromEntries(db.writes.filter((w) => w.kind === 'update').map((w) => [w.id, w]));
  assert.equal(byId.a.error_code, 'Gone');
  assert.equal(byId.b.state, 'pending');
  assert.equal(byId.c.state, 'pending');
  assert.equal(byId.d.state, 'failed');
  assert.equal(byId.e.state, 'uncertain');
});

test('refuses endpoints outside the push-service allow-list', async () => {
  const db = database([row('x', { endpoint: 'https://evil.example.com/push' })]);
  let calls = 0;
  const result = await exports.dispatchWebPush(db, async () => {
    calls++;
  });
  assert.equal(calls, 0);
  assert.equal(result.failed, 1);
  assert.equal(db.writes[0].error_code, 'InvalidEndpoint');
});
