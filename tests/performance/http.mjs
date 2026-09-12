// Local production-server smoke benchmark; no credentials, database writes, or NFC visits.
import { performance } from 'node:perf_hooks';
for (const port of [3000, 3001]) {
  for (const path of ['/login', '/']) {
    const samples = [];
    let bytes = 0;
    let status;
    let cold;
    for (let i = 0; i < 21; i++) {
      const start = performance.now();
      const response = await fetch(`http://localhost:${port}${path}`, { redirect: 'manual' });
      bytes = (await response.arrayBuffer()).byteLength;
      status = response.status;
      const elapsed = performance.now() - start;
      if (i === 0) cold = elapsed;
      else samples.push(elapsed);
    }
    samples.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        port,
        path,
        status,
        bytes,
        samples: 20,
        concurrency: 1,
        coldMs: cold,
        p50Ms: samples[9],
        p95Ms: samples[18],
      })
    );
  }
}
