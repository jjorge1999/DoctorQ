# Mobile redesign: modern, minimalist, functional, interactive

Date: 2026-08-15

## Goal

Improve the mobile experience across both audiences of the app — the public queue
board/detail pages (patients, phone-first, unauthenticated) and the staff console
(front-desk workers) — to feel modern, minimalist, functional, and interactive, with
"high impact" animation as an explicit priority rather than an afterthought.

## Scope

Both surfaces:

- Public: `queue-board`, `queue-detail`, `public-header`
- Console: `console-shell` (navigation), `queue-control`

No changes to the data model, Firestore rules, or seed data — this is a front-end-only
pass. No changes to desktop/tablet layouts beyond what naturally falls out of shared
components (e.g. `<app-live-number>` is used everywhere a live number appears,
including desktop).

## Approach

CSS-first responsiveness, consistent with how the rest of this codebase already
handles breakpoints (plain `@media` queries throughout `styles.scss`,
`console-shell.scss`, dialogs — no `BreakpointObserver`, no gesture library). New
pieces are small and independently testable.

**New dependency:** `@angular/animations`, wired via `provideAnimationsAsync()` in
`app.config.ts` (lazy-loaded). This unlocks `trigger()/transition()/query()/stagger()`
for real choreographed group animations (list stagger, status cross-fade, tab
indicator), which plain CSS can't express as cleanly.

**No other new dependencies.** Bottom sheets use Angular Material's existing
`MatBottomSheet` (already part of the `@angular/material` dependency). Page transitions
use the native browser View Transitions API via Angular Router's `withViewTransitions()`
— a first-party router feature, not a library.

Explicitly **not** doing pull-to-refresh: the app's model is Firestore snapshots
pushing live updates with no polling, so a manual refresh gesture would contradict
how the app actually works.

**Breakpoints:** two different values are used deliberately, for two different
concerns. 900px is the existing breakpoint this app already uses for structural
layout collapse (console sidenav, queue-detail's two-column-to-one-column) — kept
as-is for consistency with what's already there. 768px is new, and only governs the
board's search/filter compaction (pill search bar + bottom sheet vs. today's inline
fields) — a narrower "is this a phone" threshold, separate from the wider "is there
room for a side-by-side layout" threshold.

## Animation system foundation

### `@angular/animations` wiring

`app.config.ts` gains `provideAnimationsAsync()`. Used for:

- Staggered list entrance (board card grid, console queue cards)
- Status advice panel cross-fade (queue detail)
- Console bottom tab bar's sliding active-indicator

### `<app-live-number>` (new shared component)

A slot-machine/odometer-style number display, since the "now serving" number is the
single most-seen element in the whole app (board cards, queue detail's giant number,
console queue-control stats) — the highest-payoff place to invest animation effort.

- One `[value]: number` input. No knowledge of queues, Firestore, or any domain
  concept — testable by feeding it a sequence of numbers and asserting the rendered
  digits.
- Each digit renders in its own fixed-height, `overflow: hidden` column.
- On value change, changed digit columns slide vertically to the new digit on a
  spring-ish `cubic-bezier` with slight overshoot.
- A brief colour flash sweeps across the whole number on change, so single-digit
  changes (e.g. 12→13) still read clearly as "live."
- Respects `prefers-reduced-motion: reduce` — falls back to an instant value swap,
  no roll, no flash.

### View Transitions for card → detail navigation

`provideRouter(routes, withViewTransitions())`. Tapping a clinic card on the board
morphs into the queue detail page (visual continuity between the tapped card and the
detail header) instead of a hard navigation swap. Native browser API; falls back to a
normal instant navigation on unsupported browsers — no broken states, no polyfill.

## Public board (`queue-board`)

**Hero:** Condensed on phone widths — smaller heading clamp, reduced vertical padding —
so the fold isn't dominated by hero text before any clinic is visible. The live pulse
pill and date line stay as-is.

**Search + filter, mobile only (<768px):**

- The two Material form fields (search, hospital select) collapse into a single
  pill-shaped search bar, sticky just below the header (`position: sticky`).
- A filter icon button next to the search bar opens a `MatBottomSheet` containing the
  hospital picker — one option per row, large tap targets. Dismiss by swipe-down or
  scrim tap (Material's native motion, now real since animations are wired up).
- An active hospital filter shows as a small dismissible chip next to the search bar,
  so a filter's presence is visible without reopening the sheet.
- Desktop/tablet (≥768px): today's inline two-field layout is unchanged.

**Card grid:**

- Cards stagger in with fade+slide-up on load/filter-change
  (`@angular/animations` `query()` + `stagger()` on the `@for` list).
- Tap feedback: `scale(0.98)` + shadow-settle on `:active` (touch devices don't fire
  `:hover`, so this replaces hover as the primary interactive cue on phones).
- The "now serving" number becomes `<app-live-number>`.

## Queue detail (`queue-detail`)

- Is the view-transition target for the card tap.
- "Now serving" becomes the full-size `<app-live-number>`.
- The status advice panel (open/paused/cutoff messaging + colour) cross-fades between
  states via `@angular/animations` when status changes live under the viewer, instead
  of snapping.
- Layout keeps its existing single-column collapse under 900px — already works well,
  not touched.

## Staff console mobile nav (`console-shell`)

Below 900px (the same breakpoint the sidenav already collapses at), the sidenav is
replaced entirely by a fixed bottom tab bar:

- Icon + short label per section. Six sections (Queue, Doctors, Hospitals, Approvals,
  Staff, Settings) don't all need equal billing — Approvals/Staff/Settings collapse
  into a "More" tab opening a small sheet.
- Active tab has a sliding pill/indicator behind the icon, animated
  (`@angular/animations`, state-driven off the active route) rather than an instant
  colour swap.
- The approvals badge count moves from the sidebar item to a dot/number on the
  "More" (or Approvals) tab.
- A slim sticky top app bar carries the page title and the account/avatar button
  (currently at the bottom of the sidebar), so account access isn't lost when the
  sidebar disappears.

≥900px: today's sidebar is unchanged.

## Queue control cards (`queue-control`)

- Each card gains a swipe-left gesture (small custom pointer-events directive, touch
  only) revealing two quick actions — Call next / Pause — without opening the overflow
  menu. The existing `⋮` overflow menu remains fully functional as the non-gesture
  fallback; nothing becomes swipe-only or inaccessible without touch.
- "Now serving" and the metric numbers become `<app-live-number>`.
- Buttons get the same press-feedback treatment as board cards.
- Waiting-number chips get a pop/scale on tap, plus — progressive enhancement only —
  a short `navigator.vibrate(10)` tick on supported Android browsers when a number is
  called. Silently skipped where the Vibration API doesn't exist (iOS Safari); no
  feature-detection branching visible to the user.

## Testing

- `<app-live-number>` gets a Vitest spec: feed it a sequence of values, assert the
  rendered digit text is correct after each change. Animation timing itself isn't
  asserted, only end-state correctness.
- The swipe directive gets a spec simulating pointer down/move/up events, asserting
  reveal/close state — no real touch hardware needed.
- Existing specs for `queue-board`, `queue-detail`, `queue-control`, `console-shell`
  are updated wherever markup structure changes (new bottom sheet trigger, new bottom
  tab bar).
- `prefers-reduced-motion: reduce` is honoured throughout — odometer roll, stagger,
  and view transitions all get reduced/instant fallbacks.

## Manual verification

- `ng serve`, resize viewport / use device toolbar to confirm sticky search, bottom
  sheet, bottom tab bar, and swipe actions behave correctly at phone widths.
- Exercise the actual interactions (tap a card and watch the view transition, call a
  number and watch the odometer roll, switch console tabs and watch the sliding
  indicator) rather than only confirming things render.

## Rollout

- `npm run build`, then redeploy to Cloudflare Pages the same way as before:
  `wrangler pages deploy dist/doctorq/browser --project-name=doctorq`.
- No Firestore/data model changes in this work, so no re-seeding or rules redeploy
  is needed.
