import test from 'node:test';
import assert from 'node:assert/strict';
import { getNativeWorkerContext } from '../../../packages/database/src/worker-context.ts';
function client(
  options: { user?: string; active?: boolean; failed?: boolean; stations?: boolean } = {}
) {
  const filters: unknown[] = [];
  return {
    filters,
    value: {
      auth: {
        getUser: async () => ({ data: { user: { id: options.user ?? 'worker-a' } }, error: null }),
      },
      from: (table: string) => {
        const result =
          table === 'profiles'
            ? {
                data: { full_name: 'שם בדיקה', is_active: options.active ?? true },
                error: options.failed ? Error('db') : null,
              }
            : {
                data:
                  options.stations === false
                    ? []
                    : [
                        { stations: { id: 'station-a', code: 'A', name: 'תחנה', is_active: true } },
                        { stations: { id: 'inactive', is_active: false } },
                      ],
                error: null,
              };
        const query = {
          select: () => query,
          eq: (key: string, value: string) => {
            filters.push([table, key, value]);
            return query;
          },
          single: async () => result,
          then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
        };
        return query;
      },
    } as unknown as Parameters<typeof getNativeWorkerContext>[0],
  };
}
test('fresh context filters membership by authenticated worker and active status', async () => {
  const c = client();
  const result = await getNativeWorkerContext(c.value, 'worker-a');
  assert.equal(result.stations.length, 1);
  assert.deepEqual(c.filters, [
    ['profiles', 'id', 'worker-a'],
    ['station_memberships', 'user_id', 'worker-a'],
    ['station_memberships', 'status', 'ACTIVE'],
  ]);
});
test('account switch rejects previous expected identity before data reads', async () => {
  const c = client({ user: 'worker-b' });
  await assert.rejects(getNativeWorkerContext(c.value, 'worker-a'));
  assert.equal(c.filters.length, 0);
});
test('revoked profile and database errors never yield a partial context', async () => {
  for (const options of [{ active: false }, { failed: true }])
    await assert.rejects(getNativeWorkerContext(client(options).value, 'worker-a'));
});
test('membership revocation is reflected on subsequent read with no shared cache', async () => {
  assert.equal((await getNativeWorkerContext(client().value, 'worker-a')).stations.length, 1);
  assert.equal(
    (await getNativeWorkerContext(client({ stations: false }).value, 'worker-a')).stations.length,
    0
  );
});
test('derived identity performs one Auth read and still scopes all context queries', async () => {
  const c = client({ user: 'worker-b' });
  let calls = 0;
  c.value.auth.getUser = (async () => {
    calls++;
    return { data: { user: { id: 'worker-b' } }, error: null };
  }) as typeof c.value.auth.getUser;
  assert.equal((await getNativeWorkerContext(c.value)).userId, 'worker-b');
  assert.equal(calls, 1);
  assert.deepEqual(c.filters, [
    ['profiles', 'id', 'worker-b'],
    ['station_memberships', 'user_id', 'worker-b'],
    ['station_memberships', 'status', 'ACTIVE'],
  ]);
  await assert.rejects(getNativeWorkerContext(client({ active: false }).value));
});
