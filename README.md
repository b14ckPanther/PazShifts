<p align="center">
  <img src="apps/web/public/brand/logo-horizontal.png" alt="YellowShifts" height="56">
</p>

# YellowShifts

Workforce management for fuel stations: weekly scheduling, NFC-based attendance and hours reporting. Built for Paz stations in Israel and currently in pilot at a working station, where employees clock in by tapping a physical NFC tag at the counter.

YellowShifts is part of [Darb](https://darb.co.il). The worker app runs at [paz.darb.co.il](https://paz.darb.co.il) and the admin app at [admin.paz.darb.co.il](https://admin.paz.darb.co.il). The repository is named PazShifts; the product is YellowShifts.

## What it does

**Workers** (installable PWA, plus a native Expo app in progress)

- Clock in by tapping the station's NFC tag. The first scan starts the shift; a later scan asks for confirmation before clocking out.
- See the published weekly schedule, the current shift and the next one.
- Submit availability for the coming week.
- Track worked hours and export them as a PDF.

**Station admins and shift managers** (admin web app, used on desktop and on the station floor)

- Build weekly schedules from reusable shift templates and publish them to the team.
- Review attendance, resolve exceptions (missed check-outs, overlaps) and record manual corrections with a reason.
- Configure hour rules per station (overtime tiers, break deduction) and produce hours reports as PDF or CSV.
- Manage staff, roles and station settings.

**Platform admins** manage all stations from the same admin app.

## Architecture

```
apps/
  web/        Worker PWA (Next.js)
  admin/      Station and platform administration (Next.js)
  mobile/     Native worker app (Expo / React Native)
packages/
  database/   Supabase clients for server, browser and mobile
  reports/    Hours calculation and PDF/CSV export, shared by all apps
  types/      Shared domain and database types
  ui/         Design tokens and UI primitives
  i18n/       Translation dictionary and typed key lookup
  icons/      Icon set
  config/     TypeScript, ESLint and Prettier presets
supabase/
  migrations/ Schema, RLS policies and RPC functions
tests/        Node test runner suites and disposable-Postgres SQL tests
```

**Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript in strict mode, Supabase (Postgres, Auth, RLS), Turborepo with pnpm workspaces, Expo SDK 57. Both web apps deploy to Vercel.

## Engineering notes

A few decisions that shaped the codebase:

- **Authorization lives in the database.** Every station-scoped table is protected by Postgres Row Level Security keyed on station membership and role. The apps use the signed-in user's Supabase client, so a bug in the UI layer cannot expose another station's data. The service-role key stays on the server and is limited to the account setup scripts and two internal admin API routes.
- **Attendance writes are atomic.** An NFC scan is handled by a single Postgres function that validates the station token, checks for an open shift and inserts or closes the record in one transaction. Database constraints prevent overlapping shifts, including across stations, so double taps and concurrent requests cannot create duplicate records.
- **Hours are calculated in one place.** `packages/reports` is the only hours engine; the worker app, admin reports and the mobile app all use it. An overnight shift counts in full on its check-in date in the station's time zone (it is split at midnight only to apply night, rest-day and holiday rates), durations use elapsed time across daylight-saving changes, and only closed, valid records are counted. Flagged or overlapping records are listed for review with zero counted hours instead of being guessed.
- **Exports stay out of the main bundle.** PDF reports are generated on the client and the PDF code is loaded only when someone exports. CSV exports escape cell values that look like formulas, so a staff name cannot run as a spreadsheet formula when the file is opened in Excel.
- **No mock data.** Screens read from Supabase from the first render; tests use isolated fixtures or throwaway Postgres clusters, never the hosted database.

## Running locally

Requirements: Node.js 20+, pnpm 9+ (the repo pins pnpm 11.24), and a Supabase project with the migrations in `supabase/migrations` applied in order.

```bash
pnpm install
```

Copy `.env.example` to `.env.local` in `apps/web` and `apps/admin`, then fill in the Supabase URL and anon key. For local development, set `NEXT_PUBLIC_APP_URL=http://localhost:3000` and `NEXT_PUBLIC_ADMIN_URL=http://localhost:3001`. The admin app also needs `SUPABASE_SERVICE_ROLE_KEY` for the account scripts below.

Start both apps (worker on `:3000`, admin on `:3001`):

```bash
pnpm dev
```

Create the first accounts:

```bash
pnpm create-admin   # platform admin
pnpm create-user    # station user
```

The mobile app has its own setup; see [apps/mobile/README.md](apps/mobile/README.md).

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm format
pnpm build
node --test tests/*.test.mjs
```

The Python scripts in `tests/` (`nfc-scans-db.py`, `staff-permissions-db.py`, `sunday-weeks-db.py`) start a disposable local Postgres cluster to test migrations, RLS and the attendance functions directly.

## Further documentation

- [PRODUCT.md](PRODUCT.md): users, product principles and constraints
- [DESIGN.md](DESIGN.md): design system and visual language
- [DEPLOYMENT.md](DEPLOYMENT.md): Vercel projects, domains and Supabase auth settings
- [NFC_PILOT_CHECKLIST.md](NFC_PILOT_CHECKLIST.md): setting up and verifying a physical NFC tag
- [HOURS_REPORTS.md](HOURS_REPORTS.md): how hours are counted and exported
- [PERFORMANCE.md](PERFORMANCE.md): performance review and measurements
