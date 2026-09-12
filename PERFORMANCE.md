# Performance pass — 2026-09-12

Baseline revision: `1553f623e952795bccd9a88139c46c56dcb809e1` on `main`. The working tree was clean at inspection. No repository/ancestor AGENTS.md was present. README.md, DEPLOYMENT.md and the implemented reporting/auth/data paths were inspected. No production load tests, cloud writes, migrations, deployment, or push were performed.

## Scope and architecture

- Worker `apps/web`, admin `apps/admin`; Next **16.3.4**, React **19.2.8**, TypeScript, pnpm workspace/Turbo. Shared database, reports, UI, types, icons, i18n and config packages. No native worker project exists in this repository.
- Both Vercel projects build their respective app root and transpile workspace packages. No framework upgrades, deployment configuration changes, new dependencies or Redis client.
- Supabase uses HTTP clients (`@supabase/ssr`); there is no application PostgreSQL connection pool to tune. Direct PostgreSQL connections below are disposable tests only.
- App function and Supabase regions are not established by repository configuration; Redis is absent. Owner must compare actual Vercel function region and Supabase project region before making locality changes. No region was inferred from a domain or moved.

## Workflow inventory

All protected server reads retain validated Supabase identity, active membership/platform checks and RLS. Each app already uses React request-local `cache` for its server context (one identity check followed by three parallel profile/role/membership reads per render). Middleware also validates/refreshes the session. Those security checks were not removed or persisted across requests.

| Workflow                 | Existing path and behavior                                                                                                    | This pass                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login/session/logout     | `/login`, password actions; cookie-backed SSR session; admin POST logout and worker logout action                             | Preserved. Production-build anonymous login and protected redirects measured; authenticated session timing not measured.                                                   |
| Worker home              | `/`, selected station from active membership; embedded weekly schedule/assignments read                                       | Existing single schedule read, pending navigation feedback and loading boundaries preserved.                                                                               |
| Worker availability      | `/availability`; membership/week lookup then entries lookup                                                                   | One embedded read; same return type and date ordering.                                                                                                                     |
| NFC                      | `/nfc/[token]`, unique receipt, authenticated RPC; automatic check-in, confirmed checkout                                     | No mutations changed. Token checks, DB timestamps, locks, expiry, idempotency and uniqueness retained.                                                                     |
| Admin home/station/staff | `/`, `/stations/[id]`, `/staff`; role-scoped operations and staff management                                                  | Existing parallel data reads and separate staff screen preserved.                                                                                                          |
| Live attendance          | `/stations/[id]/attendance`; parallel active/history queries, visible-tab polling every 15 seconds; 50 history rows           | One shared visible-tab duration timer updates labels only. No full screen render every second. Status/deviation still refreshed by attendance reads.                       |
| Schedule                 | `/stations/[id]/schedules`; parallel schedule/templates/members/availability reads                                            | Existing joined schedule read preserved. No schedule mutation changes.                                                                                                     |
| Exceptions               | `/stations/[id]/exceptions`; tolerance, attendance, assignment reads                                                          | Three independent reads concurrent; assignment date/published/active-member filters execute in DB with inner joins. Query failures no longer present a false empty result. |
| Worker/admin hours       | `/hours`, `/stations/[id]/reports`; bounded date range, 1,000-row pages and stable ordering, worker user filter on every page | Faster identical classification, lighter policy-reference props, deferred collapsed worker tables. All records still available to exports.                                 |
| Exports                  | CSV in browser; jsPDF/font loaded on PDF request                                                                              | Existing lazy PDF delivery and Hebrew/RTL retained; faster shared time formatting.                                                                                         |

## Prioritized checklist

| Status / priority    | Bottleneck → evidence                                                                               | Fix                                                                                                                                | Verification                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Done / high          | Exception assignments fetched across history then filtered; 10,920 qualifying rows in local fixture | Filter related tables at source; retain application filter defensively and all RLS                                                 | Real PostgreSQL EXPLAIN ANALYZE, authenticated role; query-contract/concurrency/error regression               |
| Done / high          | 3,000-record classification takes ~942 ms                                                           | Bound formatter machinery cache; binary search intersecting dates; jump to rate boundaries when night premium cannot affect result | Identical benchmark SHA-256; existing hour tests plus 48 differential scenarios                                |
| Done / high          | 100 collapsed worker tables still render: 1.57 MB HTML                                              | Mount detail tables only when disclosure opens; selected worker opens immediately                                                  | Production React render, actual component interaction in isolated Chromium fixture; exports retain full report |
| Done / medium        | Worker availability requires two sequential data reads                                              | Embed seven-day entries in weekly record read                                                                                      | One-query contract test, sorted output, typecheck/build                                                        |
| Done / medium        | Live attendance rerenders entire screen every second                                                | Separate elapsed labels; one shared timer, hidden-tab suppression and cleanup                                                      | Fake-clock subscription regression; isolated Chromium interaction                                              |
| Evaluated / deferred | No evidence of remaining expensive repeatable stale-tolerant DB aggregate                           | Do not introduce Redis or new private-data caching                                                                                 | Optimized DB read ~1.1 ms in local fixture; avoids extra hop/invalidation/staleness                            |
| Owner follow-up      | Actual network/auth/locality and device navigation timings unknown                                  | Measure deployed authorized workflows with test accounts and performance tooling                                                   | Not claimed complete by local benchmarks                                                                       |

## Measurements

Environment: local macOS arm64, Node **26.7.0**, PostgreSQL **16.15**. Synthetic data only. Each timed case has **20 sequential measured samples**, concurrency **1**, after one first invocation. p95 is the 19th sorted observation, so these are modest local samples, not production percentiles. No development compilation is included. Before and after use the same fixture and machine; absolute times fluctuate with machine load. The production Node version should be measured separately.

| Measurement                                                                                      |                Before |                         After |
| ------------------------------------------------------------------------------------------------ | --------------------: | ----------------------------: |
| Classification, 100 workers × 30 ten-hour records, Asia/Jerusalem, daily/weekly rules; p50 / p95 |    942.19 / 968.71 ms |              28.03 / 29.71 ms |
| Classification first invocation (not a Vercel cold start)                                        |             968.09 ms |                      42.88 ms |
| Classified rows / JSON bytes                                                                     |       3,000 / 848,801 |               3,000 / 848,801 |
| Admin collapsed report, production React SSR, 100 workers × 30 entries; p50 / p95                |    172.53 / 245.40 ms |                2.94 / 3.54 ms |
| Report component HTML / mounted tables                                                           | 1,573,407 bytes / 100 | 23,607 bytes / 0 until opened |
| Exception assignment relational query, station-admin RLS, 364 days × 30 workers; p50 / p95       |    100.41 / 127.23 ms |                1.12 / 1.15 ms |
| Qualifying SQL rows / shared buffer hits (last plan)                                             |       10,920 / 57,954 |                      30 / 311 |
| Worker availability data round trips (contract test, not network timing)                         |          2 sequential |                             1 |
| Worker production `/login` HTTP body; p50 / p95                                                  |        1.70 / 2.71 ms |                1.55 / 2.40 ms |
| Admin production `/login` HTTP body; p50 / p95                                                   |        1.58 / 2.23 ms |                1.63 / 2.46 ms |

Report output SHA-256 in both runs: `15cf611f9428c77650f11d31299cd27d089f761dcdccaedec4774ee570111be1`. Forty-eight additional scenarios compare against baseline at microsecond numeric precision: UTC/Jerusalem/New York, DST dates, overnight shifts, subsecond timestamps, breaks, night/rest/holiday premiums, weekly thresholds and open/flagged records. No rate rules or date semantics were changed.

The SQL benchmark uses equivalent relational joins and filters, not PostgREST JSON serialization or network time. It applies all repository migrations and executes as authenticated station admin, retaining RLS. Existing schedule/assignment/membership indexes suffice; no speculative index was added. In the old actual HTTP query, Supabase's row cap could truncate history before the JS date filter; 10,920 is the SQL qualifying population, not a claim that production delivered all those rows.

Report SSR numbers cover the actual component, not a full authenticated Next request. Its JSON data remains present for complete exports, so 98% smaller component HTML does **not** mean a 98% smaller full RSC response. Collapsed tables trade unused initial rendering for work when opened, with no new request or artificial delay. CSV/PDF payloads remain complete.

Anonymous HTTP tests use `next start`, no cookies, localhost, no redirect following. Login response bodies stayed 15,629 worker / 14,775 admin bytes. First requests were 71.22→67.92 ms worker and 44.54→44.85 ms admin; these single observations are not cold-start distributions. Protected `/` continued returning 307 in both apps. Sub-millisecond redirect differences and small login changes are noise, not claimed gains. Chromium initially decoded 495,066 worker / 498,880 admin script bytes across 9/10 requests; afterward these were 495,196 / 499,010 bytes (130 bytes added per app). This shared login cost was not the hotspot changed here.

## Caching and Redis decision

| Layer                          | Scope / freshness / owner                                                                      | Invalidation                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Request deduplication          | Existing React `cache` context within one server render only                                   | Request ends; new requests recheck identity/roles                                                           |
| Browser UI                     | Current authorized props; existing Next navigation behavior                                    | Existing server actions/revalidation, route loads, manual refresh; attendance polls every 15 s when visible |
| Next server private-data cache | None added; no `force-cache`, `use cache`, static auth routes or stale-time overrides          | Not applicable                                                                                              |
| Redis                          | **Not added**                                                                                  | Not applicable; no provider, keys, credentials, TTLs, cost or failure dependency                            |
| CDN/service worker             | Existing framework assets; service workers cache offline help only                             | Existing offline cache versions; attendance/pages never queued or cached                                    |
| New formatter reuse            | At most 32 Intl formatter objects per module instance, keyed by timezone and date/clock format | Capacity eviction/restart; contains no records, identity, permissions, tokens or calculated results         |

Redis candidates evaluated: live dashboard aggregates need fresh attendance; historical/payroll results must reflect edits and rule changes; station settings are small reads still behind fresh authorization. No measured residual hotspot justifies serialization, a network hop and cross-app/external-writer invalidation complexity. The improvements above do not need a result-cache hit. There is no Redis hit/miss/expiry/failure path to test or disable. The formatter map is an optional computation optimization, not a durable distributed cache or business-data cache.

This follows the [Next 16 caching model without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components); no experimental caching was enabled. Embedded related-row filters use [Supabase inner-join semantics](https://supabase.com/docs/guides/database/joins-and-nesting).

## Verification and reproduction

```sh
node --test tests/*.test.mjs
python3 tests/staff-permissions-db.py
python3 tests/nfc-scans-db.py
pnpm typecheck
pnpm lint
pnpm format
pnpm build

node tests/performance/reports.mjs 1553f623e952795bccd9a88139c46c56dcb809e1
node tests/performance/reports.mjs
NODE_ENV=production node tests/performance/render.mjs 1553f623e952795bccd9a88139c46c56dcb809e1
NODE_ENV=production node tests/performance/render.mjs
node tests/performance/compare-reports.mjs 1553f623e952795bccd9a88139c46c56dcb809e1
python3 tests/performance/database.py
# With both production apps running on localhost:3000 and :3001:
node tests/performance/http.mjs
```

`pnpm typecheck`, `pnpm lint`, `pnpm format`, and both production builds passed. Node regression suite: **53 pass**. Local PostgreSQL suites pass role/station/employee isolation, protected staff, manual self/staff attendance, audit preservation, stale/overlap/time denials, hour-rule versions, atomic NFC check-in, confirmed checkout, cancellation, replay/expiry, concurrent confirmation and direct-write denial. Existing login identifier/NFC return-path/logout tests pass. No new permission or attendance result cache exists, so warmed-cache revocation/cross-app invalidation/Redis outage cases are not applicable to this change.

Chromium: production login smoke checks at 430 px and isolated real disclosure/timer components at 320/430/1280 px; open/close by click and keyboard, no page overflow or JS errors. WebKit binary is not installed; physical Safari/iPhone, authenticated production navigation, actual provider query time and cloud cold starts remain unverified. No production user credentials were used. Existing tests are a mixture of mocked action/query contracts and actual disposable PostgreSQL; they are not a hosted Supabase end-to-end session test.

## Deployment, rollback and remaining work

- No new migration, schema locking, paid service, environment variable or infrastructure step for this pass. Deploy both apps through the existing owner-managed process after reviewing/committing. Previously required migrations, including hour rules migration 15, remain prerequisites; hosted migration state was not queried here.
- Existing variables unchanged: both apps use `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ADMIN_URL`; admin additionally uses server-only `SUPABASE_SERVICE_ROLE_KEY`. No `.env.local` contents changed or staged.
- Rollback: revert the performance commit(s) and rebuild/redeploy both apps. There is no DB rollback, cache flush, Redis flag or credential removal. Formatter reuse can be removed independently without changing business data.
- Remaining: inspect actual region placement and auth/network time with dedicated test accounts; measure mobile INP and authenticated route transitions. Large reports still transfer all authorized records for complete local exports; very large exports may justify a separate server export path after measuring real demand. Other legacy admin lists retain existing limits; this pass does not claim every list has complete pagination. The existing manual-refresh and polling paths can overlap; no unsafe sharing of mutation-time reads was introduced to coalesce them.
- Keep attendance authoritative. Do not use the static NFC URL as proof of physical presence, skip revocation checks, cache active-shift decisions, or optimistically claim check-in/out success to disguise network latency.
