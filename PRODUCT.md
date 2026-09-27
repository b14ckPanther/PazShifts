# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Two installable Next.js web apps sharing `@yellowshifts/ui`: `apps/web` (worker PWA, installed on phones in standalone mode) and `apps/admin` (station administration). The native Expo app in `apps/mobile` is a separate product surface.

## Users

- **Workers** at Paz fuel stations. They open the worker app when they arrive at work and tap the station NFC tag to check in/out, when the manager shares the weekly schedule, and two or three times a week in general; some open it daily to track their hours, and some to export PDF forms/reports.
- **Shift managers**: station-scoped operational managers.
- **Station admins / managers**: use the admin app equally on an office computer (building schedules, reports, staff) and on a phone on the station floor (quick attendance fixes, changes).
- **Platform admins**: global accounts managing all stations.

## Product Purpose

YellowShifts runs a station's workforce operations: weekly schedules, shift templates and publishing, worker availability, NFC-based attendance with exceptions and manual corrections, hour rules and hours/pay reports with PDF export, staff and station management, and worker notifications. Success means a worker instantly knows whether they are on shift, where, when the next shift is, and whether their action worked; and a manager can build, publish, and correct the station's operations without friction on any device.

## Operating Context

- Worker daily touchpoint is physical: arriving at the station and tapping the NFC tag. Other visits are the weekly schedule release, availability submission, hours tracking, and PDF export.
- Admins switch between desktop planning sessions and short on-the-floor phone sessions.
- Hebrew, right-to-left, first-class. Multi-station with strict station isolation.

## Capabilities and Constraints

- Roles: platform admin, station admin, shift manager, worker; permissions enforced by Supabase RLS.
- Existing routes, actions, forms, field names, and business rules are product truth; presentation work must not change behavior.
- Real data only: no mock records or placeholder content.
- PWA installability, service worker offline fallback, and the NFC attendance flow must keep working. Brand motion never delays NFC attendance: the launch intro and navigation splash are skipped on NFC links and their login step.

## Brand Commitments

- Product name shown to users: **YellowShifts** (PazShifts is the project/repo name).
- Existing brand assets in `public/brand` and `public/icons` (logomark, mono logomark, horizontal wordmark); the logo is not redrawn or replaced.
- Brand colors: yellow `#FCBC00`, crimson `#D10040`, black, white.
- Zero-emoji policy; vector icons from `@yellowshifts/icons`.
- Heebo (Hebrew) and Ubuntu typography already in use.

## Evidence on Hand

No testimonials, metrics, or customer claims exist in the repo; none may be invented.

## Product Principles

1. Status first: the worker's current state (on shift, next shift, action result) is always the clearest thing on screen.
2. Operational speed beats decoration; nothing may slow down check-in, scheduling, or corrections.
3. One product family: worker is simpler and mobile-native, admin is denser and productivity-oriented, both unmistakably YellowShifts.
4. Every device is a first-class device for admins; phones are the primary device for workers.

## Accessibility & Inclusion

Hebrew RTL, visible focus, adequate contrast, large touch targets, status never conveyed by color alone, `prefers-reduced-motion` respected.
