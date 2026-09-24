import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { Buffer } from 'node:buffer';
const { Request, Response, AbortSignal } = globalThis;
const ts = createRequire(import.meta.url)('typescript');
function load(path, mocks = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports,
      require: (n) => {
        assert.ok(n in mocks, n);
        return mocks[n];
      },
      Response,
      fetch: async () => {
        throw Error('Unexpected network call');
      },
      Buffer,
      AbortSignal,
    }
  );
  return exports;
}
const contract = load('packages/database/src/station-interest.ts');
const { handleStationInterest: handle } = load('apps/admin/app/api/station-interest/handler.ts', {
  'node:crypto': { createHmac },
  'node:net': { isIP },
  '@yellowshifts/database/public': contract,
});
const body = {
  full_name: 'בדיקת מערכת',
  phone: '0501234567',
  station_name_or_number: 'בדיקה',
  city: 'חיפה',
  request_id: '00000000-0000-4000-8000-000000000024',
  platform: 'ios',
  app_version: '1.0.0',
};
const env = { VERCEL: '1', STATION_LEADS_RATE_SECRET: 'test-only-secret-'.repeat(3) };
const request = (value = body, headers = {}) =>
  new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.1', ...headers },
    body: JSON.stringify(value),
  });
function db(result = 'created') {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { result, id: 'lead-fixture' } };
    },
    from: () => ({
      update: (value) => ({
        eq: async () => {
          calls.push(value);
          return { error: null };
        },
      }),
    }),
  };
}
test('public intake uses hashed IP, server contract and fixed source; no PII response', async () => {
  const d = db();
  const r = await handle(request(), d, env, async () => {
    throw Error('email not configured');
  });
  assert.equal(r.status, 202);
  assert.deepEqual(await r.json(), { accepted: true });
  assert.match(d.calls[0].args.p_ip_hash, /^[a-f0-9]{64}$/);
  assert.equal(d.calls[0].args.p_lead.phone, body.phone);
  assert.equal(d.calls.length, 1);
});
test('rejects missing fields, invalid metadata, privilege injection and oversized payload', async () => {
  for (const value of [
    { ...body, phone: '' },
    { ...body, platform: 'web' },
    { ...body, status: 'converted' },
    { ...body, request_id: 'bad' },
    { ...body, notes: 'a'.repeat(9000) },
  ]) {
    const d = db();
    assert.equal((await handle(request(value), d, env)).status, 400);
    assert.equal(d.calls.length, 0);
  }
});
test('untrusted hosting/IP and missing rate secret fail closed', async () => {
  for (const e of [
    { ...env, VERCEL: '0' },
    { ...env, STATION_LEADS_RATE_SECRET: '' },
  ])
    assert.equal((await handle(request(), db(), e)).status, 503);
  assert.equal((await handle(request(body, { 'x-forwarded-for': 'fake' }), db(), env)).status, 503);
});
test('limited requests return retry guidance; duplicates do not email twice', async () => {
  let sends = 0;
  const limited = await handle(request(), db('limited'), env);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '3600');
  const r = await handle(
    request(),
    db('duplicate'),
    {
      ...env,
      RESEND_API_KEY: 'fixture',
      STATION_LEADS_EMAIL: 'test@example.test',
      STATION_LEADS_FROM: 'test@example.test',
    },
    async () => {
      sends++;
    }
  );
  assert.equal(r.status, 202);
  assert.equal(sends, 0);
});
test('email failure does not discard a stored lead and email uses an idempotency key', async () => {
  for (const ok of [true, false]) {
    const d = db();
    const r = await handle(
      request(),
      d,
      {
        ...env,
        RESEND_API_KEY: 'fixture',
        STATION_LEADS_EMAIL: 'test@example.test',
        STATION_LEADS_FROM: 'test@example.test',
      },
      async (url, init) => {
        assert.equal(url, 'https://api.resend.com/emails');
        assert.equal(init.headers['Idempotency-Key'], 'station-interest/lead-fixture');
        assert.equal(JSON.parse(init.body).html, undefined);
        return { ok };
      }
    );
    assert.equal(r.status, 202);
    assert.equal(d.calls[1].email_status, ok ? 'sent' : 'failed');
  }
});
test('database errors are not accepted or leaked', async () => {
  const r = await handle(
    request(),
    { rpc: async () => ({ error: { message: 'private backend details' } }) },
    env
  );
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'unavailable' });
});
