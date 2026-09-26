---
version: 1
slug: "apps-web-app-page-tsx"
primary_target: "apps/web/app/page.tsx"
related_targets: ["apps/web/app/home/page.tsx"]
---

# Surface brief: YellowShifts worker PWA (apps/web)

Scope: all worker surfaces (home, my shifts, availability, hours, NFC attendance, login, error/empty states) plus the app shell and bottom tab bar. Visitor mode: Operate.

Audience and job: station workers on a phone, often standing at the forecourt in daylight, arriving at work and tapping the NFC tag; also weekly schedule checks, availability submission, hours tracking and PDF export.
Constraints: behavior, routes, forms and copy meaning unchanged; Hebrew RTL; PWA standalone + browser; safe areas; reduced motion; launch intro kept at 1600ms (user choice).

## Direction contract

THESIS: The worker app is the station's operations board in a pocket. Current state (on shift + elapsed time, or the next shift) reads like a forecourt price sign: large tabular numerals on a calm ground. It refuses the generic SaaS stack of same-size white cards with icon + heading + text.

OWN-WORLD: Warm concrete ground (#F3F2EE) with white raised panels (hairline border + soft offset shadow), warm ink (#1C1714). Yellow #FCBC00 is the canopy: the header band and the selection indicator only. Crimson #D10040 is action and live state (primary buttons, on-shift panel); deep crimson #8F002B for pressed state and crimson text. Heebo for all UI text; Ubuntu for numerals (times, durations, counts) with tabular figures. One restrained 45-degree cut motif taken from the logomark's strokes, used on the full-screen canopy (login, NFC and error flows) and the live status panel only; the sticky app header stays a flat band so it never competes with content. Radii 10/14/20. Status chips pair icon + text and vary in shape (filled = live, outlined = upcoming, muted = done, amber triangle = attention).

STORY: The worker opens the app and instantly knows whether they are working, where, and when the next shift is; then sees the week and what they need to do (submit availability). Every action ends in an unmistakable result state.

FIRST VIEWPORT (home, 390x844): yellow canopy band (logomark, station name, person) compact at top under the safe area; greeting as the h1 without an eyebrow; the status panel as the dominant element: on shift = crimson panel with the elapsed timer in 48-64px Ubuntu numerals (raised from 44-48px so it reads at arm's length on the forecourt), check-in time and station; off shift = next-shift panel with weekday/date and the time range in large numerals; then a short row of next steps (this week's shifts, availability); white bottom tab bar 64px + safe area, active tab marked by a yellow pill behind the icon and a bold ink label. From 768px the same four destinations move into the canopy as pill tabs (no bottom bar on wide screens).

FORM: User-pinned world, in the user's words: "Reuse the EXISTING BRAND ASSETS from the repository. Do not create an unrelated visual identity. Do not replace the logo. Do not change the product's fundamental brand colors." and "Use the existing PazShifts identity intelligently." So no concept-seed roll: this extends the incumbent YellowShifts world. Code-led (no image generation). Signature interaction: the tab bar indicator pill springs in under the selected icon; attendance success draws a check. Motion 150-250ms, reduced-motion safe.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
