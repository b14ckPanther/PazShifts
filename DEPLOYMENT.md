# YellowShifts — Production Deployment Guide (Vercel)

This document provides the exact deployment configuration for hosting YellowShifts on Vercel with custom Paz domains.

---

## 1. Domain & Routing Topology

| Application                  | Target Domain            | Monorepo Root Directory | Framework            |
| :--------------------------- | :----------------------- | :---------------------- | :------------------- |
| **Worker App** (`apps/web`)  | `shifts.paz.co.il`       | `apps/web`              | Next.js (App Router) |
| **Admin App** (`apps/admin`) | `admin.shifts.paz.co.il` | `apps/admin`            | Next.js (App Router) |

- **Physical NFC Tags**: Programmed strictly to `https://shifts.paz.co.il/nfc/<token>`
- **Supabase Project**: `https://pqbfeilezhtoofjaeobl.supabase.co`

---

## 2. Setting Up Project 1: Worker App (`apps/web`)

1. In the [Vercel Dashboard](https://vercel.com/new), select the `b14ckPanther/PazShifts` repository.
2. Configure project settings:
   - **Project Name**: `yellowshifts-web` (or `shifts-paz`)
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/web`
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://pqbfeilezhtoofjaeobl.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: _(Value from `apps/web/.env.local`)_
   - `NEXT_PUBLIC_APP_URL`: `https://shifts.paz.co.il`
   - `NEXT_PUBLIC_ADMIN_URL`: `https://admin.shifts.paz.co.il`
4. Deploy project.
5. In **Settings > Domains**, add:
   - `shifts.paz.co.il`

---

## 3. Setting Up Project 2: Admin App (`apps/admin`)

1. In the [Vercel Dashboard](https://vercel.com/new), import the same `b14ckPanther/PazShifts` repository again.
2. Configure project settings:
   - **Project Name**: `yellowshifts-admin` (or `admin-shifts-paz`)
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/admin`
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://pqbfeilezhtoofjaeobl.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: _(Value from `apps/admin/.env.local`)_
   - `SUPABASE_SERVICE_ROLE_KEY`: _(Value from `apps/admin/.env.local` — NEVER expose to client)_
   - `NEXT_PUBLIC_APP_URL`: `https://shifts.paz.co.il`
   - `NEXT_PUBLIC_ADMIN_URL`: `https://admin.shifts.paz.co.il`
4. Deploy project.
5. In **Settings > Domains**, add:
   - `admin.shifts.paz.co.il`

---

## 4. DNS Configuration (Paz IT / Registrar)

Configure DNS records for `paz.co.il`:

| Type    | Name           | Value                   | Purpose                   |
| :------ | :------------- | :---------------------- | :------------------------ |
| `CNAME` | `shifts`       | `cname.vercel-dns.com.` | Worker Portal & NFC Scans |
| `CNAME` | `admin.shifts` | `cname.vercel-dns.com.` | Admin Portal              |

---

## 5. Supabase Auth Redirect URLs

In Supabase Dashboard (**Authentication > URL Configuration**):

- **Site URL**: `https://shifts.paz.co.il`
- **Redirect URLs**:
  - `https://shifts.paz.co.il/**`
  - `https://admin.shifts.paz.co.il/**`
  - `http://localhost:3000/**` _(for local development)_
  - `http://localhost:3001/**` _(for local development)_
