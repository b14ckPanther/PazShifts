import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
function pageFor(context) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../apps/admin/app/page.tsx', import.meta.url), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }
    ).outputText,
    {
      exports,
      require(name) {
        if (name === 'next/headers') return { cookies: async () => ({}) };
        if (name === 'next/navigation')
          return {
            redirect: (path) => {
              throw new Error(`REDIRECT:${path}`);
            },
          };
        if (name === '@yellowshifts/database')
          return {
            isSupabaseConfigured: () => true,
            createServerSupabaseClient: () => ({}),
            getAuthenticatedUserContext: async () => context,
          };
        if (name === 'react/jsx-runtime')
          return {
            jsx: (type, props) => ({ type, props }),
            jsxs: (type, props) => ({ type, props }),
          };
        return new Proxy({}, { get: (_, key) => key });
      },
    }
  );
  return exports.default;
}
const membership = (id, status = 'ACTIVE') => ({
  station: { id },
  membership: { role: 'ADMIN', status },
});
test('station admins enter the shared operational dashboard, preserving authorized station selection', async () => {
  const page = pageFor({
    user: { id: 'manager' },
    profile: {},
    isPlatformAdmin: false,
    memberships: [membership('one'), membership('two'), membership('inactive', 'SUSPENDED')],
  });
  await assert.rejects(page({ searchParams: Promise.resolve({}) }), /REDIRECT:\/stations\/one/);
  await assert.rejects(
    page({ searchParams: Promise.resolve({ stationId: 'two' }) }),
    /REDIRECT:\/stations\/two/
  );
  for (const stationId of ['not-their-station', 'inactive'])
    await assert.rejects(
      page({ searchParams: Promise.resolve({ stationId }) }),
      /REDIRECT:\/stations\/one/
    );
});
test('signed-out admin entry requires authentication', async () => {
  await assert.rejects(pageFor(null)({ searchParams: Promise.resolve({}) }), /REDIRECT:\/login/);
});
