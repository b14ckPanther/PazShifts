import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoundedFetch } from '../src/lib/network.ts';
test('timeout aborts request without retrying', async () => {
  let calls = 0;
  const transport: typeof fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      calls++;
      init?.signal?.addEventListener('abort', () => reject(Error('aborted')));
    });
  await assert.rejects(createBoundedFetch(transport, 5)('https://example.invalid'));
  assert.equal(calls, 1);
});
test('caller cancellation remains effective', async () => {
  const controller = new AbortController();
  controller.abort();
  const transport: typeof fetch = async (_input, init) => {
    assert.equal(init?.signal?.aborted, true);
    throw Error('aborted');
  };
  await assert.rejects(
    createBoundedFetch(transport)('https://example.invalid', { signal: controller.signal })
  );
});
test('database failure response is preserved rather than hidden or retried', async () => {
  const response = new Response('failure', { status: 503 });
  let calls = 0;
  const transport: typeof fetch = async () => {
    calls++;
    return response;
  };
  assert.equal(await createBoundedFetch(transport)('https://example.invalid'), response);
  assert.equal(calls, 1);
});
