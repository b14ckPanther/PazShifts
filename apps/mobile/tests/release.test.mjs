import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function config(env = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL('../app.config.ts', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports, process: { env } }
  );
  return exports.default;
}
test('owner-confirmed release identity is separated from development and conflicts fail closed', () => {
  assert.equal(config().ios.bundleIdentifier, 'il.co.darb.yellowshifts.dev');
  for (const profile of ['preview', 'production']) {
    const c = config({ EAS_BUILD_PROFILE: profile });
    assert.equal(c.ios.bundleIdentifier, 'il.co.darb.yellowshifts');
    assert.equal(c.android.package, 'il.co.darb.yellowshifts');
    assert.equal(c.ios.associatedDomains.length, 0);
    assert.equal(c.android.intentFilters.length, 0);
    assert.equal(c.extra.features.backgroundLocation, false);
  }
  assert.throws(() =>
    config({ EAS_BUILD_PROFILE: 'production', MOBILE_IOS_BUNDLE_ID: 'il.co.darb.yellowshifts.dev' })
  );
});
test('signed QA capabilities require explicit release opt-in and retain narrow hosts', () => {
  const c = config({
    EAS_BUILD_PROFILE: 'production',
    EXPO_PUBLIC_NATIVE_NFC_ENABLED: 'true',
    EXPO_PUBLIC_BACKGROUND_LOCATION_ENABLED: 'true',
  });
  assert.equal(c.ios.associatedDomains.length, 2);
  assert.equal(c.android.intentFilters[0].data[0].pathPrefix, '/nfc/');
  assert.equal(c.extra.features.backgroundLocation, true);
  const plugin = c.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location');
  assert.equal(plugin[1].isAndroidForegroundServiceEnabled, false);
});
test('default release location config omits background permissions but retains foreground NFC purpose', () => {
  const c = config({ EAS_BUILD_PROFILE: 'production' }),
    p = c.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location')[1];
  assert.equal(p.isIosBackgroundLocationEnabled, false);
  assert.equal(p.isAndroidBackgroundLocationEnabled, false);
  assert.equal(p.locationAlwaysAndWhenInUsePermission, false);
  assert.match(p.locationWhenInUsePermission, /NFC/);
});
test('patched router query decoder handles malformed input without recursive blowup', () => {
  const require = createRequire(import.meta.url),
    routerRequire = createRequire(require.resolve('expo-router/package.json'));
  const query = routerRequire('query-string');
  assert.equal(query.parse('name=%D7%A9%D7%9C%D7%95%D7%9D').name, 'שלום');
  const value = query.parse('x=' + '%80'.repeat(2000)).x;
  assert.equal(typeof value, 'string');
  assert.equal(query.parse('station=Curdani&day=2026-09-13').station, 'Curdani');
});
test('disabled location capability never requests any OS permission', async () => {
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/location/runtime.ts', import.meta.url), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText,
    {
      exports,
      require: (n) =>
        n === '../lib/features'
          ? { backgroundLocationEnabled: false }
          : n === '../auth/secure-storage'
            ? { createSecureStorage: () => ({}) }
            : {},
      __DEV__: false,
    }
  );
  assert.equal(await exports.permissionState(), 'unavailable');
  assert.equal(
    await exports.requestReminderPermissions(() => {
      throw Error('must not prompt');
    }),
    'unavailable'
  );
});
test('release plist guard removes unused permissions and preserves opted-in geofencing', () => {
  const module = { exports: {} };
  runInNewContext(
    readFileSync(new URL('../plugins/withReleaseGuardrails.cjs', import.meta.url), 'utf8'),
    { module, require: () => ({ withInfoPlist: (config, apply) => apply(config) }) }
  );
  const input = () => ({
    modResults: {
      NSFaceIDUsageDescription: 'unused',
      NSLocalNetworkUsageDescription: 'development',
      NSBonjourServices: ['_expo._tcp'],
      UIBackgroundModes: ['fetch', 'location', 'remote-notification'],
    },
  });
  const result = module.exports(input(), { release: true, backgroundLocation: false }).modResults;
  assert.equal(result.NSFaceIDUsageDescription, undefined);
  assert.equal(result.NSLocalNetworkUsageDescription, undefined);
  assert.equal(result.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
  assert.equal(result.UIBackgroundModes.join(','), 'remote-notification');
  assert.equal(
    module
      .exports(input(), { release: true, backgroundLocation: true })
      .modResults.UIBackgroundModes.includes('location'),
    true
  );
  assert.throws(() => config({ EAS_BUILD_PROFILE: 'unknown-release' }));
});
