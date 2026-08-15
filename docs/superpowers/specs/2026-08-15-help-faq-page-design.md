# Help & FAQ page — design

## Purpose

A single page that answers "how does this work?" for whoever is looking at it — a patient
checking a queue, or signed-in staff/admin running one — without maintaining separate FAQ and
guide pages that drift out of sync.

## Placement

One public route, `/help`, alongside the other top-level public routes (`/`, `/q/:id`). No route
guard — content adapts to who's looking rather than who's allowed in.

- `src/app/public/help-page.ts` / `.html` / `.scss` — new standalone component, `OnPush`, using
  `PublicHeader` for chrome (same as `queue-board` and `queue-detail`).
- `app.routes.ts`: `{ path: 'help', loadComponent: () => import('./public/help-page')..., title: 'Help & FAQ · DoctorQ' }`.

Entry points:

- `PublicHeader` gets a "Help" link, visible on every public page.
- `PublicHeader`'s existing right-side button becomes role-aware: "Staff sign in" → `/login` when
  signed out (unchanged), "Console" → `/console` when already signed in. Today it always reads
  "Staff sign in", which would strand a signed-in user who navigates to `/help`.
- `console-shell.html` sidenav footer gets a "Help & FAQ" link next to the existing
  "View public board" link.

## Content

Two accordion sections (`mat-expansion-panel` per Q&A), shown conditionally by role. Content is
static copy owned by the component — no new Firestore data, no service.

### 1. For patients — always shown, expanded by default

- What the queue number means, and what "now serving" vs "last number issued" mean.
- What each status means: open, paused, cut-off, closed (mirrors `QUEUE_STATUS_LABEL` /
  `status-chip` wording already in the app).
- How "estimated wait" is calculated (waiting count × avg minutes/patient) and that it's an
  estimate, not a promise.
- There is no physical ticket — the number on this page *is* the queue; nothing to print or hold.
- What to do if cut-off is reached before arriving (don't travel — you will not be seen).
- Privacy note: no patient names or health information are ever shown on this board.
- Link back to "all clinics" (the board).

### 2. For staff & admins — shown only when `auth.isApproved()` is true

- Opening a queue for a doctor at a hospital (one queue per doctor/hospital/day).
- Issuing a walk-in number, calling next, calling a specific number out of turn (priority call),
  undoing the last call.
- Pausing/closing a queue, and editing session details (room, hours, capacity, note).
- Managing doctors and hospitals — who can add one (owner concept), what "approved" means.
- Entries visible to admins only (gated `@if (isAdmin())`), grouped at the end of this section:
  - The approvals workflow (what shows up there, why it exists).
  - Managing staff accounts and access settings (auto-approve toggles).

### Fallbacks in place of section 2

- Signed in, not yet approved: short notice reusing the tone of `console-shell`'s existing
  "Waiting for approval" empty state — no staff content shown.
- Signed out: a small callout: "Sign in as staff to see the console guide" linking to `/login`.

## Visual design

Modern, minimalist, functional — an extension of the existing system, not a new style:

- `.page` container (max-width 1240px), `page-title` / `page-subtitle` header, matching every
  other page in the app.
- Each section is a `surface-card` (18px radius, 1px `--app-border`) containing a heading and a
  flat `mat-expansion-panel` list — no heavy shadows, generous padding, consistent with
  `queue-detail`'s existing card/advice patterns.
- A small pill/chip row at the top lets the user jump between visible sections when more than one
  is shown (patients / staff / admin extras) — omitted entirely when only one section renders, so
  a signed-out visitor sees a clean single-section page with no dead chrome.

## Out of scope

- No CMS/editable content — copy lives in the component.
- No search within the FAQ.
- No i18n.
- No changes to the doctor-avatar seed work (tracked separately).
