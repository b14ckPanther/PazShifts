// Inspect local export artifacts only; prints module names, never source contents/env values.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]
  );
}
const maps = files(new URL('../dist', import.meta.url).pathname).filter((p) => p.endsWith('.map'));
if (maps.length < 2) throw Error('Export both platforms with --source-maps before this check.');
const forbidden = [
  /tests\/visual/,
  /nfc-preview/,
  /apps\/admin\//,
  /@supabase\/ssr/,
  /jspdf/i,
  /notification-delivery/,
  /database\/src\/(?:admin|server|middleware)/,
  /node:(?:fs|child_process|crypto)/,
];
for (const file of maps) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const bad = data.sources.filter((s) => forbidden.some((re) => re.test(s)));
  if (bad.length) throw Error(`Unsafe bundle modules: ${bad.join(', ')}`);
}
console.log(`PASS: ${maps.length} source maps contain no forbidden server/fixture/export modules.`);
