---
version: 1
slug: "apps-admin-app-page-tsx"
primary_target: "apps/admin/app/page.tsx"
related_targets: []
---

# Surface brief: YellowShifts station admin (apps/admin)

Scope: every admin surface (login, dashboard/stations, station overview, staff, staff member, schedules, templates, attendance, exceptions, reports, report settings, station create/edit) plus the admin shell and navigation. Visitor mode: Operate.

Audience and job: station admins, shift managers and platform admins, equally on an office computer (building schedules, reports, staff) and on a phone on the station floor (quick attendance fixes and changes).
Constraints: behavior, routes, permissions, forms and field names unchanged; Hebrew RTL; phones are first-class; no horizontal scroll except genuinely wide grids.

## Direction contract

THESIS: The admin app is the station's control room: the same forecourt world as the worker app, denser and productivity-first. What needs attention (who is on now, unpublished schedule, exceptions) leads; navigation follows. It refuses the generic SaaS dashboard of equal metric tiles and full-bleed stretched tables.

OWN-WORLD: Same tokens as the worker app: warm concrete ground (#F3F2EE), white panels with hairline + soft offset shadow, warm ink, yellow #FCBC00 canopy band as header identity and selection, crimson #D10040 primary actions, Heebo UI text with Ubuntu tabular numerals for times, hours and counts. Denser rhythm (8px grid, 36-40px controls on desktop, 44px on touch), content width capped (~1240px) so desktop never stretches. Tables become row cards under 720px. Dialogs are one consistent sheet/dialog component: bottom sheet on phones, centered dialog on desktop; the one exception is staff assignment, which docks as a side sheet at the inline start on desktop so the week grid it edits stays visible behind it.

STORY: A manager lands on the station, sees today's operational state and what is waiting for them, and reaches staff, schedules, attendance and reports in one tap, on any device.

FIRST VIEWPORT (station overview, 1440x900 and 390x844): canopy band header with station identity and station switcher; section navigation as tabs (desktop) / white bottom tab bar (phone); a status strip of live facts (on shift now, open exceptions, schedule state) with icon + text statuses; primary actions (build schedule, add staff) in predictable top-end positions.

FORM: User-pinned world, in the user's words: "Reuse the EXISTING BRAND ASSETS from the repository. Do not create an unrelated visual identity. Do not replace the logo. Do not change the product's fundamental brand colors." and "Use the existing PazShifts identity intelligently." So no concept-seed roll: this extends the incumbent YellowShifts world. Code-led. Signature interaction: the shared tab indicator and sheet motion (sheet rises from the bottom on phones). Motion 150-250ms, reduced-motion safe.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
