# Phase 11 — Deployment preparation (temporary Vercel domains)

The application is **not deployed**. Domain ownership or authorization from Paz is not confirmed. Preparation does not establish production or real-station pilot readiness. The user will push GitHub and create both Vercel projects manually; nothing in this guide requires deployment from the CLI.

## Step A — Push the repository to GitHub

From the repository root, review and commit the preparation changes, then push the existing `main` branch:

```sh
git status --short
git diff --check
git add -A
git diff --cached --stat
git commit -m "Prepare temporary Vercel deployment and NFC pilot configuration"
git push -u origin main
```

The configured remote is `https://github.com/b14ckPanther/PazShifts.git`. Review staged paths before committing. `.env.local`, build output, TypeScript caches, and local Vercel metadata are ignored. Never force-add environment files or paste credentials into Git. Use the real Supabase settings privately in Vercel; example files contain placeholders only.

## Step B — Create two Vercel projects

Import the same GitHub repository twice in the [Vercel dashboard](https://vercel.com/new). Select `main` as the production branch and Next.js as the framework. Project names are your choice.

## Step C — Configure roots and builds

| Setting                                     | Worker project                   | Admin project                    |
| ------------------------------------------- | -------------------------------- | -------------------------------- |
| Root Directory                              | `apps/web`                       | `apps/admin`                     |
| Framework                                   | Next.js                          | Next.js                          |
| Build Command (from project root)           | `pnpm build`                     | `pnpm build`                     |
| Install Command                             | `pnpm install --frozen-lockfile` | `pnpm install --frozen-lockfile` |
| Output Directory                            | Next.js default                  | Next.js default                  |
| Include source files outside Root Directory | Enabled                          | Enabled                          |

Use Node.js 24.x for both projects. Set `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the repository's `packageManager` pin (`pnpm@11.24.0`). Confirm the version in the first build log. The root `pnpm-workspace.yaml` and lockfile resolve `workspace:*` packages; both Next.js configs transpile the shared source packages. No separate package publishing or `vercel.json` is required. Root `pnpm build` runs both apps through Turborepo; each project-directory `pnpm build` runs only that app's `next build`.

These settings follow [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build) and [monorepo source access](https://vercel.com/docs/monorepos/monorepo-faq). A successful local build verifies repository resolution, not Vercel deployment.

Configure these variables in the **Production** environment:

| Variable                        | Worker                            | Admin                             |
| ------------------------------- | --------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Actual Supabase project URL       | Same project URL                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Actual anon/public key            | Same anon/public key              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Do not set                        | Actual secret, server-only        |
| `NEXT_PUBLIC_APP_URL`           | Actual worker origin after Step D | Actual worker origin after Step D |
| `NEXT_PUBLIC_ADMIN_URL`         | Actual admin origin after Step D  | Actual admin origin after Step D  |
| `ENABLE_EXPERIMENTAL_COREPACK`  | `1`                               | `1`                               |

Never prefix the service-role key with `NEXT_PUBLIC_`. It must not reach browser code. Local `.env.local` files are not uploaded by Git. If enabling Preview deployments, configure their environments deliberately; do not use arbitrary previews as physical tag destinations.

### Staff permissions migration

Before deploying the updated staff-management screens, apply `supabase/migrations/20260911000009_staff_permission_boundaries.sql` to the intended Supabase project after the preceding migrations. It limits station admins to workers and shift managers, prevents self-edits and physical membership deletion, and protects station identity while retaining operational settings. No existing memberships or attendance records are deleted or reassigned. This migration has been tested locally; that does not mean it has been applied to your hosted project.

Regression checks (repository root):

```sh
node --test tests/staff-actions.test.mjs
python3 tests/staff-permissions-db.py
```

The database test requires PostgreSQL binaries on PATH and creates/removes its own isolated local cluster. It never connects to Supabase. Deploy the code and migration together, then verify with separate super-admin and station-admin accounts.

## Step D — Deploy once to discover the real domains

Deploy each project with the Supabase variables and Corepack setting. Leave the two application-origin variables **unset** on this initial deployment if the domains are not known. Do not deploy example placeholders or local origins as production configuration.

Read each project's assigned production `.vercel.app` domain in Vercel. For example only, these might be `yellowshifts-web.vercel.app` and `yellowshifts-admin.vercel.app`; names are not guaranteed. Use stable project production domains, not a commit-specific preview URL.

At this stage, same-app login routing uses the actual request origin. Cross-app admin navigation and NFC URL copying show an unavailable/configuration message until their destination is configured. The admin origin cannot safely identify the separate worker origin. This first deployment is not pilot-ready.

## Step E — Set actual origins and redeploy both

Set the following on **both** projects, replacing the angle-bracket placeholders:

```dotenv
NEXT_PUBLIC_APP_URL=https://<actual-worker-vercel-domain>
NEXT_PUBLIC_ADMIN_URL=https://<actual-admin-vercel-domain>
```

Use HTTPS origins only, with no path, query, credentials, or fragment. A trailing slash is normalized. Redeploy both projects: Next.js public environment values are captured at build time. Verify the worker's admin link opens the actual admin project and the admin's NFC URL starts with the actual worker origin.

For local development only, both ignored `.env.local` files use:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
```

## Step F — Supabase Auth and deployed validation

After obtaining actual domains, open Supabase **Authentication > URL Configuration**:

- **Site URL**: `https://<actual-worker-vercel-domain>`.
- **Redirect URLs**: add both actual origins, plus `https://<actual-worker-vercel-domain>/**` and `https://<actual-admin-vercel-domain>/**` for application return paths. Replace every placeholder before saving; never allow all `*.vercel.app` domains.
- Keep `http://localhost:3000/**` and `http://localhost:3001/**` only if that Supabase project also serves local development.

Supabase's [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls) describes Site URL and allow-list matching. Current login uses email/password and application redirects, rather than an OAuth callback. Worker and admin sessions are separate browser-origin sessions. Their login actions accept internal `next` paths, and middleware derives same-app redirects from the incoming request.

Verify on the deployed apps before writing the tag:

1. Worker login, logout, and station access work.
2. Admin login and role restrictions work.
3. A logged-out `/nfc/<station-token>` visit goes to `/login?next=...` on the worker origin and returns to the same NFC route after login.
4. External/protocol-relative `next` values do not redirect off-site.
5. Admin NFC copying produces exactly the worker-origin URL and the existing station token resolves correctly.
6. Required Supabase migrations and station memberships are present. Verify these separately; a build does not validate the deployed database.

## Step G — Authorized custom domains later

Only after Paz authorizes domain use, add the approved worker and admin custom domains to their respective Vercel projects and complete Vercel's DNS verification with the authorized domain administrator. Replace both origin variables on both projects, redeploy both, and update Supabase Site URL/redirect entries. No application architecture change is needed.

Rewrite the NFC tag with `<authorized-worker-origin>/nfc/<same-station-token>`. A domain change does not require token rotation. Keep the tag writable during the temporary-domain pilot; retain old-domain access while tags are being migrated if needed.

## NFC and physical pilot status

Before deployment, no physical NFC URL is verified or ready to write. After deployment, use `https://<actual-worker-vercel-domain>/nfc/<station-token>` copied from the admin portal. Check it matches the assigned worker domain before programming the tag. See [NFC_PILOT_CHECKLIST.md](NFC_PILOT_CHECKLIST.md).

| Item                       | Status                        |
| -------------------------- | ----------------------------- |
| NFC tag hardware available | YES (user has the card/tag)   |
| NFC URL ready to write     | PENDING ACTUAL DEPLOYMENT URL |
| NFC tag written            | PENDING USER                  |
| Physical phone scan        | PENDING USER                  |
| Clock-in/out physical test | PENDING USER                  |
| Real station pilot         | NOT READY                     |

Automated code, database, and route checks are separate from physical testing. This preparation does not claim a deployed application, a verified production redirect, a programmed tag, or a completed Phase 11 production deployment.
