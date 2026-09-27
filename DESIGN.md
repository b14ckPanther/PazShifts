---
name: YellowShifts
description: Forecourt operations board for station workers (PWA) and station admins, one Hebrew RTL product family.
colors:
  canopy-yellow: '#fcbc00'
  canopy-yellow-subtle: '#fff4cc'
  canopy-yellow-ink: '#5c4300'
  crimson: '#d10040'
  crimson-hover: '#b30037'
  crimson-deep: '#8f002b'
  crimson-subtle: '#fdebf0'
  crimson-text: '#c2003b'
  splash-wine: '#700020'
  concrete-ground: '#f3f2ee'
  panel-white: '#ffffff'
  concrete-muted: '#ecebe6'
  concrete-sunken: '#e7e5df'
  surface-soft: '#faf9f6'
  warm-ink: '#1c1714'
  ink-secondary: '#554d47'
  ink-muted: '#6e665f'
  hairline: '#e6e2da'
  border-medium: '#d5cfc4'
  border-strong: '#9d9489'
  success: '#1f8a4c'
  success-ink: '#17693a'
  success-subtle: '#e5f3ea'
  warning: '#d97a00'
  warning-ink: '#8a4b00'
  warning-subtle: '#fff0d9'
  danger: '#c8102e'
  danger-ink: '#a10d26'
  danger-subtle: '#fdeaed'
  info: '#1f5fbf'
  info-ink: '#174a95'
  info-subtle: '#e7effb'
typography:
  display:
    fontFamily: 'Ubuntu, Heebo, -apple-system, sans-serif'
    fontSize: 'clamp(3rem, 15vw, 4rem)'
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: '0'
    fontFeature: "'tnum' 1, 'lnum' 1"
  numeral:
    fontFamily: 'Ubuntu, Heebo, -apple-system, sans-serif'
    fontSize: '2rem'
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: '-0.01em'
    fontFeature: "'tnum' 1, 'lnum' 1"
  headline:
    fontFamily: "Heebo, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '1.625rem'
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: '-0.02em'
  headline-compact:
    fontFamily: "Heebo, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '1.375rem'
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: '-0.02em'
  title:
    fontFamily: "Heebo, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '1.0625rem'
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Heebo, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Heebo, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '0.8125rem'
    fontWeight: 600
    lineHeight: 1.35
  caption:
    fontFamily: "Heebo, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '0.75rem'
    fontWeight: 600
    lineHeight: 1.45
rounded:
  xs: '6px'
  sm: '10px'
  md: '14px'
  lg: '18px'
  xl: '26px'
  pill: '9999px'
spacing:
  '2': '2px'
  '4': '4px'
  '6': '6px'
  '8': '8px'
  '10': '10px'
  '12': '12px'
  '14': '14px'
  '16': '16px'
  '20': '20px'
  '24': '24px'
  '32': '32px'
  '40': '40px'
  '48': '48px'
  '64': '64px'
components:
  button-primary:
    backgroundColor: '{colors.crimson}'
    textColor: '{colors.panel-white}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '0 18px'
    height: '44px'
  button-primary-hover:
    backgroundColor: '{colors.crimson-hover}'
  button-primary-active:
    backgroundColor: '{colors.crimson-deep}'
  button-secondary:
    backgroundColor: '{colors.panel-white}'
    textColor: '{colors.warm-ink}'
    rounded: '{rounded.sm}'
    padding: '0 18px'
    height: '44px'
  button-tertiary:
    backgroundColor: 'transparent'
    textColor: '{colors.crimson-deep}'
    rounded: '{rounded.sm}'
    padding: '0 10px'
    height: '44px'
  button-destructive:
    backgroundColor: '{colors.danger}'
    textColor: '{colors.panel-white}'
    rounded: '{rounded.sm}'
    padding: '0 18px'
    height: '44px'
  input:
    backgroundColor: '{colors.panel-white}'
    textColor: '{colors.warm-ink}'
    rounded: '{rounded.sm}'
    padding: '10px 14px'
    height: '44px'
  card:
    backgroundColor: '{colors.panel-white}'
    textColor: '{colors.warm-ink}'
    rounded: '{rounded.lg}'
    padding: 'clamp(16px, 3.2vw, 24px)'
  segmented-track:
    backgroundColor: '{colors.concrete-sunken}'
    rounded: '{rounded.md}'
    padding: '4px'
  segmented-selected:
    backgroundColor: '{colors.panel-white}'
    textColor: '{colors.warm-ink}'
    rounded: '{rounded.sm}'
    height: '40px'
  canopy-header:
    backgroundColor: '{colors.canopy-yellow}'
    textColor: '{colors.warm-ink}'
    height: '60px'
  canopy-tab-active:
    backgroundColor: '{colors.panel-white}'
    textColor: '{colors.warm-ink}'
    rounded: '{rounded.pill}'
    height: '38px'
  tab-bar:
    backgroundColor: '{colors.panel-white}'
    textColor: '{colors.ink-muted}'
    height: '64px'
  tab-bar-indicator:
    backgroundColor: '{colors.canopy-yellow}'
    rounded: '{rounded.pill}'
    width: '60px'
    height: '32px'
  status-live:
    backgroundColor: '{colors.crimson}'
    textColor: '{colors.panel-white}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '3px 10px 3px 12px'
  live-panel:
    backgroundColor: '{colors.crimson}'
    textColor: '{colors.panel-white}'
    rounded: '{rounded.xl}'
    padding: '18px 20px 20px'
  dialog:
    backgroundColor: '{colors.panel-white}'
    textColor: '{colors.warm-ink}'
    rounded: '{rounded.xl}'
    width: 'min(560px, calc(100vw - 32px))'
---

# Design System: YellowShifts

## Overview

**Creative North Star: "The Forecourt Board"**

YellowShifts is the station's operations board: the worker PWA is that board in a pocket, the admin app is the control room for the same forecourt. Both share one token file and one component layer (`packages/ui`). The yellow canopy sits overhead as identity, a warm concrete ground carries white raised panels, and the numbers that matter (elapsed time, shift range, counts) are set like a price sign: large, tabular, calm. Current state leads every screen; navigation follows.

The worker app is simpler and phone-native (bottom tab bar, one dominant status panel). The admin app is denser (40px controls under a fine pointer, 1240px content cap, tables that fold to row cards under 720px) but unmistakably the same world. Hebrew RTL is the default direction, and every layout rule is written with logical properties.

The system refuses the generic SaaS stack: no equal-size metric tiles, no row of identical white cards with icon + heading + text, no dark notification banners. Live facts are written as a labelled line; lists are one panel divided by hairlines.

**Key Characteristics:**

- Yellow canopy overhead, crimson for action and live state, warm concrete ground, white panels.
- Heebo for all words, Ubuntu tabular numerals for every time, duration and count.
- Soft offset shadows tinted with warm ink; hairline borders on every panel.
- Statuses always icon + text, with shape varying by kind.
- One selection language inside pages, one navigation language per form factor.
- Phones are first-class: 44px touch targets, 16px inputs on touch, bottom sheets, safe areas.

## Colors

Two brand hues with strict jobs over a warm, slightly yellowed neutral ramp; status hues each come as a trio (signal, text-safe ink, subtle fill).

### Primary

- **Canopy Yellow** (#fcbc00): the canopy. The sticky header band in both apps, the 45-degree cut band on full-screen flows (login, NFC attendance, the worker error and not-found pages), the one cut corner on the live panel, the launch reveal and navigation splash, and selection indicators (the bottom tab bar pill, a checked option's border, the "window" availability choice). Never a button fill for ordinary actions, never body text.
- **Canopy Yellow Subtle** (#fff4cc) and **Canopy Yellow Ink** (#5c4300): the quiet form of the brand: empty-state and message icon wells, brand alerts, header subtitles and unselected canopy tab labels.

### Secondary

- **Forecourt Crimson** (#d10040): action and live state. Primary buttons, the on-shift panel, the live status pill, live counts in fact lines, switches and checkbox accent, the text caret.
- **Crimson Hover** (#b30037) and **Deep Crimson** (#8f002b): hover and pressed states of crimson actions; Deep Crimson is also the crimson text colour for tertiary buttons and crimson badges.
- **Crimson Subtle** (#fdebf0): tertiary-button hover and crimson badge fill.
- **Splash Wine** (#700020): ink on the default yellow splash entrance only (orbit ring, dot, progress track). Both apps now show the 3D logomark reveal instead, so it survives only in the shared `BrandEntrance` fallback.

### Neutral

- **Concrete Ground** (#f3f2ee): the page. White panels read as raised against it without heavy shadow.
- **Panel White** (#ffffff): cards, lists, tables, dialogs, the bottom tab bar, raised segments.
- **Concrete Muted** (#ecebe6): quiet panels (idle rows, subtle cards), disabled fields, neutral status fill, skeletons.
- **Concrete Sunken** (#e7e5df): the track under segmented controls and in-page section pills.
- **Warm Ink** (#1c1714): all primary text and the focus ring; also the avatar disc on the canopy.
- **Ink Secondary** (#554d47) and **Ink Muted** (#6e665f): descriptions, labels, inactive tabs, metadata.
- **Hairline** (#e6e2da), **Border Medium** (#d5cfc4), **Border Strong** (#9d9489): panel edges and row dividers; field and secondary-button borders; hover borders.

### Status

- Success, Warning, Danger and Info each ship signal / ink / subtle values (see frontmatter). Text always uses the `-ink` value, which is legible on white and on its own subtle fill.

### Named Rules

**The Canopy Rule.** Yellow is overhead identity and selection, nothing else. If a yellow surface is neither the canopy, a brand moment (splash, reveal, NFC in-progress or confirmation symbol) nor a selected state, it is wrong.

**The Crimson Means Go Rule.** Crimson marks the one thing to do or the one thing happening now. A screen has one crimson primary action per region; the live shift is the only crimson field.

**The Ink Trio Rule.** Status text uses the `-ink` value on white or on the matching `-subtle` fill. The raw signal colour is for fills, borders and icons, never small text.

## Typography

**UI Font:** Heebo (with -apple-system, Segoe UI, Roboto, sans-serif)
**Numeral Font:** Ubuntu (with Heebo fallback), tabular and lining figures

**Character:** Heebo carries Hebrew with a sturdy, neutral voice at heavy weights for headings; Ubuntu's rounded, slightly technical figures make times and counts read like a forecourt price board.

### Hierarchy

- **Display** (Ubuntu 500, clamp(3rem, 15vw, 4rem), 1.05): the live elapsed timer on the on-shift panel. One per screen.
- **Numeral** (Ubuntu 500, 2rem to clamp(2.5rem, 12vw, 3rem) as the hero, 1.15): next-shift time range, attendance timers (2.25rem in admin), hours totals.
- **Headline** (Heebo 800, 1.625rem, 1.2, -0.02em; 1.375rem under 640px): page h1 and greeting. Dialog titles use 1.25rem 800.
- **Title** (Heebo 700, 1.0625rem, 1.3): card, empty-state and section titles.
- **Body** (Heebo 400, 0.9375rem, 1.55): descriptions and paragraphs, capped at 62ch in page headers and 44ch in empty states.
- **Label** (Heebo 600, 0.8125rem): field labels, segmented options, canopy tabs, button text on small buttons (buttons are 600 at 0.9375rem).
- **Caption** (Heebo 600 to 700, 0.75rem): statuses, badges, fact labels (`dt`). No uppercase, no tracking: Hebrew has no case, and captions are not styled as kickers.

### Named Rules

**The Price Board Rule.** Every number that carries data (times, durations, counts, dates in numerals, hours) is set in Ubuntu with tabular lining figures (the `.ys-num` utility). Date, time, number and tel inputs inherit it automatically.

**The No Eyebrow Rule.** Headings stand alone. The greeting is the h1; no small label above a heading announces its section.

## Layout

A 4px grid (steps 2 to 64px) with a fluid gutter of clamp(16px, 4vw, 32px). Content never stretches: the admin shell caps at 1240px plus gutters, the worker canopy at 1140px, the worker home column at 600px, forms at 640 to 880px, reading text at 720px.

Rhythm is tight and vertical: page sections stack in grids with 10 to 24px gaps; cards pad at clamp(16px, 3.2vw, 24px); list rows are at least 60px tall with 12px by 16px padding. Page headers put text at the inline start and actions at the inline end, wrapping to full width under 640px.

Breakpoints observed in the build: 360px (tight phones), 520px (form actions go full width), 640px (dialogs become bottom sheets, page headers compact), 720px (stacked tables become row cards), 768px (bottom tab bar gives way to canopy tabs), 1024px (canopy tab labels and account name reappear; the admin schedule offers its week grid, below this it is a single-day view with day tabs). Pointer type also drives density: `pointer: fine` shrinks controls to 40/32/48px and inputs to 15px; touch keeps 44/40/52px and 16px inputs so iOS never zooms.

Admin screens share one shell: `.admin-page` holds the canopy header (`AdminHeader`, or `StationHeader` on station pages) and a Container with `.admin-page-body`, a grid with 20px gaps (16px under 640px). Inside it, an optional pill back link, a title row (page header text at the inline start, actions at the inline end), `.admin-toolbar` filter rows whose actions go full width on phones, and `.admin-section` blocks.

The phone shell owns one bottom clearance region (64px tab bar + safe area + 12px) and scroll padding so focused fields clear the bar. All insets honour `env(safe-area-inset-*)`. Horizontal overflow is clipped at the root; only genuinely wide grids (the week schedule) scroll sideways.

**The Logical Side Rule.** Position with `inline-start` / `inline-end` and `margin-inline`, never left/right, except for physical decorations deliberately pinned to a corner (the live panel cut) and the transforms that must be flipped per direction.

## Elevation & Depth

A hybrid: tonal layering does most of the work (sunken track < concrete ground < white panel), and shadows are soft, offset downward, and tinted with warm ink `rgba(40, 28, 16, …)`, always paired with a hairline border on panels. No hard offset shadows, no glows, no pure-black shadows.

### Shadow Vocabulary

- **Subtle** (`box-shadow: 0 1px 2px rgba(40, 28, 16, 0.06)`): secondary buttons.
- **Raised** (`box-shadow: 0 1px 2px rgba(40, 28, 16, 0.05), 0 2px 8px rgba(40, 28, 16, 0.05)`): hover lift on interactive cards (combined with a wider 8px/24px layer).
- **Card** (`box-shadow: 0 1px 2px rgba(40, 28, 16, 0.05), 0 4px 14px rgba(40, 28, 16, 0.05)`): every panel, list, table wrap and stacked row card.
- **Segment** (`box-shadow: 0 1px 2px rgba(40, 28, 16, 0.1), 0 2px 6px rgba(40, 28, 16, 0.06)`): the selected white segment on a sunken track.
- **Dropdown** (`box-shadow: 0 4px 12px rgba(40, 28, 16, 0.1), 0 12px 32px rgba(40, 28, 16, 0.1)`): account menu and popovers.
- **Modal** (`box-shadow: 0 12px 28px rgba(40, 28, 16, 0.14), 0 32px 64px rgba(40, 28, 16, 0.14)`): dialogs and sheets.
- **Bar** (`box-shadow: 0 -1px 0 rgba(40, 28, 16, 0.08), 0 -6px 20px rgba(40, 28, 16, 0.06)`): the bottom tab bar, cast upward.
- **Crimson lift** (`box-shadow: 0 1px 2px rgba(143, 0, 43, 0.25), 0 3px 10px rgba(209, 0, 64, 0.18)`): primary buttons only; flattens to the first layer when pressed.
- **Canopy edge** (`box-shadow: 0 1px 0 rgba(92, 67, 0, 0.14)`): the one-pixel yellow-ink line under the sticky canopy.

### Named Rules

**The Hairline Plus Shadow Rule.** A white panel always carries both a 1px hairline (#e6e2da) and the Card shadow. Quiet panels (Concrete Muted) carry neither.

**The One Focus Rule.** Focus is a 2px warm-ink outline at 2px offset plus a 5px yellow halo `rgba(252, 188, 0, 0.55)`, visible on white, concrete and yellow alike. Fields swap the outline for an ink border plus a 4px halo.

## Shapes

Softly rounded, never sharp and never blobby. Radii step 6 / 10 / 14 / 18 / 26px plus pill: 10px for buttons, fields and segments; 14px for large buttons, alerts, tracks and inner fact blocks; 18px for cards, lists and tables; 26px for dialogs, the login panel and the live panel; pill for badges, statuses, canopy tabs and the tab bar indicator. Bottom sheets round only their top corners; the assignment side sheet rounds only its inline-end corners.

One geometric motif comes from the logomark: a 45-degree cut. It appears as the yellow band cut across the top of full-screen flows (`polygon(0 0, 100% 0, 100% 72%, 0 100%)`) and as one yellow triangle in the corner of the live shift panel. It appears nowhere else; the sticky header stays a flat band.

Status shape encodes kind: filled pill = live; outlined pill = upcoming; dashed border = pending or draft; muted pill = completed or offline; squarer 8px corners = attention (late, warning, rejected, error).

## Components

### Buttons

Confident and compact, with a small press-in.

- **Shape:** gently rounded (10px; 14px on large).
- **Primary:** Forecourt Crimson fill, white 600 text, 44px tall on touch (40px under a fine pointer), 18px inline padding, Crimson lift shadow.
- **Hover / Active / Focus:** hover to Crimson Hover; press to Deep Crimson with `scale(0.97)`; the One Focus ring. Loading hides the label under a centred spinner and keeps the width.
- **Secondary:** white with Border Medium and Subtle shadow; hover strengthens the border. **Outline** and **Ghost** are transparent variants. **Tertiary:** Deep Crimson text, Crimson Subtle on hover. **Destructive:** Danger fill; **Destructive outline:** white with danger-ink text.
- **Sizes:** sm 40px (32px fine), md 44px (40px), lg 52px (48px); icon buttons are square at the same heights. Under 520px form actions go full width; in sheets, footer buttons share the row.

### Status and Badges

- **StatusBadge:** always a vector icon plus text, 0.75rem 700, 26px min height. Live is a crimson pill with a pulsing yellow dot; the rest follow the shape rules in Shapes.
- **Badge:** neutral, crimson, success, warning, danger, info, all subtle fill plus `-ink` text; the `brandYellow` variant renders as a white outlined badge, not a yellow fill.
- **Inline feedback (admin):** action results appear in place as `.admin-feedback`, a 14px-radius strip in the success or danger subtle fill with `-ink` text, paired with `role="status"` or `role="alert"`. It replaces dark banners.

### Cards / Containers

- **Corner Style:** 18px.
- **Background:** Panel White; subtle variant is Concrete Muted without border or shadow.
- **Shadow Strategy:** Card shadow plus hairline (see Elevation). Interactive cards deepen the border and shadow on hover and press to `scale(0.995)`.
- **Internal Padding:** clamp(16px, 3.2vw, 24px).
- **Lists:** many rows live in one panel separated by hairlines, never a box per row.

### Inputs / Fields

- **Style:** white fill, 1px Border Medium, 10px radius, 44px min height, 10px by 14px padding, 16px text on touch (15px and 40px under a fine pointer). Selects use a custom chevron at the inline end. Date and time inputs drop the native appearance so they fill their column on iOS Safari like every other field.
- **Focus:** warm-ink border plus a 4px yellow halo.
- **Error / Disabled:** danger border on a faint pink fill with a danger-ink message led by an icon; disabled goes Concrete Muted with muted text.
- **Switch:** a native checkbox dressed as a 44 by 26px pill, crimson when on.

### Navigation

- **Canopy header (both apps):** `WorkerHeader` and `AdminHeader` (wrapped by `StationHeader` on station pages). Sticky, 60px, Canopy Yellow under the safe area, logomark in a white 40px tile, 1.0625rem 800 title with a yellow-ink subtitle, account avatar as a 38px warm-ink disc with yellow initials. The avatar opens an account menu: a white dropdown panel (18px radius, Dropdown shadow, 180ms entrance) with the person and role, station name and code, and the logout button.
- **Desktop / tablet (768px and up):** section tabs sit in the canopy as pills on a translucent white track; the current tab is a white pill with ink 700 text and a yellow-ink tinted shadow. Labels hide to icons between 768 and 1023px. In the admin app the tabs appear on station pages for station admins and shift managers, and come from the same list as its phone tab bar (`station-nav.ts`).
- **Phones (under 768px):** a white 64px bottom tab bar plus safe area with the Bar shadow; the current tab gets a 60 by 32px yellow pill that springs in behind its 24px icon and a bold ink label. A still-loading destination shows a half-opacity pill at once. The admin app shows the same bar (`StationDock`) on station pages.
- **In-page switches:** one selection language: a white raised segment on a Concrete Sunken track (segmented controls, station section pills such as attendance / exceptions, the attendance tabs, the schedule day tabs, the login method switch).
- **Back link (admin):** a 40px pill link in secondary ink above a page header, returning to the parent screen; it fills with Concrete Muted on hover.
- **Week switcher (worker):** the selected week is the headline: a compact day/month range in Ubuntu numerals that never wraps, the year(s) in a muted caption below, and quiet previous / next arrows.
- **Navigation feedback:** a 3px yellow-crimson-yellow progress line under the safe area while a route loads. Admin route loading shows only this line plus a `RouteSkeleton` (title, subtitle and two card shapes, pulsing), never a splash.

### Dialogs and Sheets

- **Base:** native `<dialog>`, white, 26px radius, Modal shadow, 560px (820px large), warm overlay `rgba(28, 23, 20, 0.52)`; header, a content-sized body that scrolls only once the dialog reaches its max height, and a Surface Soft (#faf9f6) footer divided by a hairline; a form's own action row stays pinned to the bottom while the body scrolls. Enters in 220ms with a small rise. The dialog itself takes focus on open, so no focus ring flashes on the close button.
- **Phones (640px and under):** the same dialog becomes a bottom sheet: full width, top corners rounded, a 40 by 4px grab handle, rising in 280ms.
- **Exception:** staff assignment docks as a full-height 520px side sheet at the inline start above 640px, sliding in over 240ms, so the week grid it edits stays visible.

### Fact Lines

Live state is written, not tiled. Under a page header, a single wrapping line of labelled facts (a crimson dot and crimson numeral for live counts, warning-ink for items needing attention). The admin station overview holds its live facts in one status strip: a single panel with three linked facts divided by hairlines, stacking under 760px. Profiles and panels use definition lists: 0.75rem muted `dt` over a 0.9375rem 600 `dd`, divided by hairlines.

### Live Shift Panel (signature)

The worker home's hero when on shift: a crimson field with 26px corners, one yellow 45-degree cut in the physical top-left corner, the live StatusBadge, the elapsed timer in Display numerals, then a fact block (check-in time, station) on translucent deep crimson. With no live shift, the next-shift panel takes the hero role with its time range at up to 3rem.

### Empty and Loading States

Empty states centre a 52px yellow-subtle icon well, a Title, a 44ch explanation and an optional action. Skeletons shimmer between Concrete Muted and #f6f5f1.

### Brand Reveal and Splash

Both apps open with `LaunchIntro`: a 1150ms 3D reveal of the logomark on Canopy Yellow, server-rendered as the first paint, that fades to the app with a slight scale-up while the app hydrates underneath. It plays once per launch session (sessionStorage) and never on NFC attendance links or their login step. With reduced motion, the static front-facing mark holds briefly and then fades over 450ms.

In the worker app, moving between tabs raises the navigation splash (`BrandSplash`), which replays the same reveal on a yellow radial gradient for a minimum of 1000ms and until the destination's content is ready; worker route loading screens show the same reveal, and a loading screen stays hidden under a splash already running. The splash never shows on NFC links. The admin app has no navigation splash: routes change under the progress line and skeleton only.

## Do's and Don'ts

### Do:

- **Do** keep Canopy Yellow (#fcbc00) to the canopy, brand moments and selection indicators.
- **Do** use Forecourt Crimson (#d10040) for the primary action and the live state, with Deep Crimson (#8f002b) on press.
- **Do** set every time, duration and count in Ubuntu tabular numerals (`.ys-num`).
- **Do** pair every status with a vector icon and text through StatusBadge; let the shape follow the kind.
- **Do** give white panels a hairline plus the warm-ink Card shadow on the Concrete Ground (#f3f2ee).
- **Do** keep touch targets at 44px and inputs at 16px on touch devices.
- **Do** write layout with logical properties so RTL and LTR both hold.
- **Do** gate every transition and animation behind `prefers-reduced-motion`; keep UI motion at 150 to 280ms.
- **Do** use native `<dialog>` for every dialog, becoming a bottom sheet at 640px and under.

### Don't:

- **Don't** fill ordinary buttons, badges or panel headings with yellow.
- **Don't** convey status by colour alone.
- **Don't** build dashboards from equal metric tiles; write live facts as a labelled line.
- **Don't** put a small label, eyebrow or kicker above headings, and don't uppercase or letter-space captions.
- **Don't** use hard offset shadows, black shadows or glows.
- **Don't** repeat the 45-degree cut beyond the full-screen canopy flows and the live panel.
- **Don't** redraw or replace the logomark, or use emoji; icons come from `@yellowshifts/icons`.
- **Don't** stretch content past the 1240px cap on desktop.
