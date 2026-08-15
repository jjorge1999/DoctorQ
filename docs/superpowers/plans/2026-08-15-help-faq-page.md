# Help & FAQ Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single `/help` page to the DoctorQ Angular app whose content adapts to who is
signed in — a patient FAQ always shown, plus a staff/admin console guide shown only to signed-in,
approved accounts — and wire it into both the public header and the console sidenav.

**Architecture:** One new standalone, `OnPush` component (`HelpPage`) reads `AuthService`'s
existing `isSignedIn`/`isApproved`/`isAdmin` signals and renders static FAQ content (plain arrays
in the component, no service, no Firestore reads) inside `mat-accordion` sections gated by those
signals. `PublicHeader` and `console-shell.html` each get one new link pointing at the route.

**Tech Stack:** Angular 22 standalone components, Angular Material (`MatExpansionModule`,
`MatButtonModule`, `MatIconModule`), signals, `@angular/build:unit-test` (vitest under the hood,
`TestBed`).

## Global Constraints

- Route is public, no guard — content adapts by role rather than gating access (spec: Placement).
- No new Firestore reads and no new subscriptions — this page must not be a source of memory
  leaks or extra realtime listeners; all content is static, and the only reactive state it reads
  is `AuthService`'s existing signals (spec: Content; confirmed against `auth.service.ts`).
- The route is lazy-loaded via `loadComponent`, matching every other route in `app.routes.ts` —
  do not add it to any eagerly-loaded module.
- Visual style must match the existing system exactly: `.page` container, `page-title` /
  `page-subtitle`, `surface-card`, `--app-radius` (18px), `--app-border` — no new design tokens.
- No i18n, no CMS/editable content, no search within the FAQ (spec: Out of scope).

---

## File Structure

Create:
- `src/app/public/help-page.ts` — component: FAQ data + auth-driven computed signals.
- `src/app/public/help-page.html` — template.
- `src/app/public/help-page.scss` — styles.
- `src/app/public/help-page.spec.ts` — tests for all four auth states.
- `src/app/shared/public-header.spec.ts` — tests for the new Help link + role-aware button.
- `src/app/console/console-shell.spec.ts` — test for the new Help & FAQ sidenav link.

Modify:
- `src/app/app.routes.ts` — add the `/help` route.
- `src/app/shared/public-header.ts` — add a Help link; make the right-side button role-aware.
- `src/app/console/console-shell.html` — add a Help & FAQ link in the sidenav footer.

---

### Task 1: `HelpPage` — patient FAQ + route

**Files:**
- Create: `src/app/public/help-page.ts`
- Create: `src/app/public/help-page.html`
- Create: `src/app/public/help-page.scss`
- Create: `src/app/public/help-page.spec.ts`
- Modify: `src/app/app.routes.ts:10-14` (insert after the `q/:id` route)

**Interfaces:**
- Produces: `HelpPage` class with public readonly signals `isSignedIn`, `isApproved`, `isAdmin`
  (re-exposed from `AuthService`), `patientFaqs: FaqEntry[]`, `staffFaqs: FaqEntry[]`,
  `adminFaqs: Signal<FaqEntry[]>`, `showStaffSection: Signal<boolean>`,
  `showPendingNotice: Signal<boolean>`, `showSignInCallout: Signal<boolean>`,
  `sectionCount: Signal<number>`. `FaqEntry = { q: string; a: string }`. Task 2 adds to this same
  file/class — it does not replace anything Task 1 produces.

- [ ] **Step 1: Write the failing test for the patient section always rendering**

```typescript
// src/app/public/help-page.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { HelpPage } from './help-page';

function fakeAuth(overrides: Partial<{ isSignedIn: boolean; isApproved: boolean; isAdmin: boolean }>) {
  return {
    isSignedIn: signal(overrides.isSignedIn ?? false),
    isApproved: signal(overrides.isApproved ?? false),
    isAdmin: signal(overrides.isAdmin ?? false),
  } as unknown as AuthService;
}

describe('HelpPage', () => {
  async function render(auth: AuthService) {
    await TestBed.configureTestingModule({
      imports: [HelpPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(HelpPage);
    fixture.detectChanges();
    return fixture;
  }

  it('always renders the patient FAQ section, signed out', async () => {
    const fixture = await render(fakeAuth({}));
    const panels = fixture.nativeElement.querySelectorAll('#patients mat-expansion-panel');
    expect(panels.length).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='**/help-page.spec.ts'`
Expected: FAIL — `help-page.ts` does not exist yet (module resolution error).

- [ ] **Step 3: Write the component**

```typescript
// src/app/public/help-page.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PublicHeader } from '../shared/public-header';

export interface FaqEntry {
  q: string;
  a: string;
}

const PATIENT_FAQS: FaqEntry[] = [
  {
    q: 'What does the queue number mean?',
    a: 'Every patient who takes a slot gets the next number in line. "Now serving" is the number currently with the doctor; "last number issued" is the highest number handed out so far.',
  },
  {
    q: 'What do "open", "paused", "cut-off" and "closed" mean?',
    a: '"Open" — still accepting patients. "Paused" — the doctor has stepped away; numbers already issued keep their place. "Cut-off" — every slot for today is gone; do not travel if you do not already hold a number. "Closed" — the clinic has ended for the day.',
  },
  {
    q: 'How is the estimated wait calculated?',
    a: 'The number of patients still waiting, multiplied by the average minutes this doctor spends per patient. It is an estimate, not a promise.',
  },
  {
    q: 'Do I need a physical ticket?',
    a: 'No. This page is the ticket — there is nothing to print or collect at the front desk. Just watch this page for your number.',
  },
  {
    q: 'What if cut-off is reached before I arrive?',
    a: 'Do not travel to the hospital. Once a queue reaches its daily cap it will not see any further walk-ins, even if you have not been issued a number yet.',
  },
  {
    q: 'Is my information shown on this board?',
    a: 'No. This board shows queue numbers only — never patient names or health information.',
  },
];

@Component({
  selector: 'app-help-page',
  imports: [MatButtonModule, MatExpansionModule, MatIconModule, RouterLink, PublicHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help-page.html',
  styleUrl: './help-page.scss',
})
export class HelpPage {
  private readonly auth = inject(AuthService);

  readonly isSignedIn = this.auth.isSignedIn;
  readonly isApproved = this.auth.isApproved;
  readonly isAdmin = this.auth.isAdmin;

  readonly patientFaqs = PATIENT_FAQS;

  readonly showStaffSection = computed(() => this.isSignedIn() && this.isApproved());
  readonly showPendingNotice = computed(() => this.isSignedIn() && !this.isApproved());

  readonly sectionCount = computed(() => 1 + (this.showStaffSection() ? 1 : 0));
}
```

```html
<!-- src/app/public/help-page.html -->
<app-public-header />

<main class="page">
  <h1 class="page-title">Help &amp; FAQ</h1>
  <p class="page-subtitle">
    Answers for patients checking a queue, and a walkthrough for staff running one.
  </p>

  <section id="patients" class="surface-card faq-section">
    <h2>For patients</h2>
    <mat-accordion multi>
      @for (item of patientFaqs; track item.q) {
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>{{ item.q }}</mat-panel-title>
          </mat-expansion-panel-header>
          <p>{{ item.a }}</p>
        </mat-expansion-panel>
      }
    </mat-accordion>
  </section>
</main>
```

```scss
// src/app/public/help-page.scss
:host {
  display: block;
  min-height: 100%;
}

.faq-section {
  padding: 8px 24px 24px;
  margin-bottom: 20px;

  h2 {
    margin: 24px 0 12px;
    font-size: 1.1rem;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  mat-expansion-panel {
    box-shadow: none !important;
    border-top: 1px solid var(--app-border);

    &::before {
      display: none;
    }

    &:first-of-type {
      border-top: none;
    }
  }

  p {
    margin: 0 0 16px;
    color: var(--mat-sys-on-surface-variant);
    font-size: 0.92rem;
    line-height: 1.6;
  }
}
```

Add the route in `app.routes.ts`, right after the `q/:id` route:

```typescript
  {
    path: 'help',
    loadComponent: () => import('./public/help-page').then((m) => m.HelpPage),
    title: 'Help & FAQ · DoctorQ',
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='**/help-page.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/public/help-page.ts src/app/public/help-page.html src/app/public/help-page.scss src/app/public/help-page.spec.ts src/app/app.routes.ts
git commit -m "feat: add /help page with patient FAQ section"
```

---

### Task 2: `HelpPage` — staff/admin section and fallbacks

**Files:**
- Modify: `src/app/public/help-page.ts` (adds to the class from Task 1 — same file)
- Modify: `src/app/public/help-page.html`
- Modify: `src/app/public/help-page.scss`
- Modify: `src/app/public/help-page.spec.ts`

**Interfaces:**
- Consumes: `HelpPage.showStaffSection`, `showPendingNotice`, `sectionCount`, `isAdmin` from Task 1.
- Produces: `HelpPage.staffFaqs: FaqEntry[]`, `HelpPage.adminFaqs: Signal<FaqEntry[]>`,
  `HelpPage.showSignInCallout: Signal<boolean>` — nothing downstream depends on these beyond this
  task's own template.

- [ ] **Step 1: Write the failing tests for the three remaining auth states**

Append to `src/app/public/help-page.spec.ts`, inside the existing `describe('HelpPage', ...)`
block, after the first `it`:

```typescript
  it('shows the sign-in callout and no staff section when signed out', async () => {
    const fixture = await render(fakeAuth({}));
    expect(fixture.nativeElement.querySelector('#staff')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Staff sign in');
    expect(fixture.nativeElement.querySelector('.jump-nav')).toBeNull();
  });

  it('shows a pending-approval notice, not the staff section, when unapproved', async () => {
    const fixture = await render(fakeAuth({ isSignedIn: true, isApproved: false }));
    expect(fixture.nativeElement.querySelector('#staff')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Waiting for approval');
  });

  it('shows the staff FAQ section, without admin entries, for approved staff', async () => {
    const fixture = await render(fakeAuth({ isSignedIn: true, isApproved: true, isAdmin: false }));
    const panels = fixture.nativeElement.querySelectorAll('#staff mat-expansion-panel');
    expect(panels.length).toBe(6);
    expect(fixture.nativeElement.querySelector('.jump-nav')).not.toBeNull();
  });

  it('adds admin entries to the staff section for admins', async () => {
    const fixture = await render(fakeAuth({ isSignedIn: true, isApproved: true, isAdmin: true }));
    const panels = fixture.nativeElement.querySelectorAll('#staff mat-expansion-panel');
    expect(panels.length).toBe(9);
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx ng test --include='**/help-page.spec.ts'`
Expected: FAIL — no `#staff` section, no `.jump-nav`, no "Waiting for approval"/"Staff sign in" text yet.

- [ ] **Step 3: Extend the component, template and styles**

In `help-page.ts`, add the staff/admin FAQ data and the two remaining computed signals — insert
after `PATIENT_FAQS` and inside the class alongside the Task 1 fields:

```typescript
const STAFF_FAQS: FaqEntry[] = [
  {
    q: 'How do I open a queue for a doctor?',
    a: 'From Queue control, start a new queue for a doctor at a hospital. A doctor can only have one open queue per hospital per day.',
  },
  {
    q: 'How do I hand out the next number?',
    a: 'Use "Issue number" to give a walk-in the next sequential number.',
  },
  {
    q: 'How do I call a patient?',
    a: '"Call next" calls the lowest waiting number. To call a specific patient out of turn — someone who cannot wait, or was missed — use "Call number" instead; the board marks it as a priority call so nobody looks skipped.',
  },
  {
    q: 'I called the wrong number — can I undo it?',
    a: 'Yes. "Call previous" puts the last-called number back into the waiting list and returns to serving the one before it.',
  },
  {
    q: 'How do I pause or close a queue?',
    a: 'Pausing keeps issued numbers in place while new ones wait; closing ends the clinic day. Both are set from Queue control, along with the room, hours, capacity and a note patients see on their queue page.',
  },
  {
    q: 'How do I add a doctor or a hospital?',
    a: 'From the Doctors or Hospitals pages. Doctors and hospitals you add are yours to manage; an administrator can see and manage every doctor and hospital.',
  },
];

const ADMIN_FAQS: FaqEntry[] = [
  {
    q: 'What shows up in Approvals?',
    a: 'New staff sign-ups, and doctors or hospitals added by staff, when auto-approval is off for that type. Nothing there is visible to patients until you approve it.',
  },
  {
    q: 'How do I manage staff accounts?',
    a: 'From the Staff page: assign doctors to a staff member, promote another account to admin, or remove access.',
  },
  {
    q: 'What do the access settings control?',
    a: 'Whether new staff sign-ups and staff-added doctors/hospitals need your approval before they can be used, from the Settings page.',
  },
];
```

Add inside the `HelpPage` class, after `showPendingNotice`:

```typescript
  readonly showSignInCallout = computed(() => !this.isSignedIn());

  readonly staffFaqs = STAFF_FAQS;
  readonly adminFaqs = computed(() => (this.isAdmin() ? ADMIN_FAQS : []));
```

Replace the body of `help-page.html` (everything inside `<main class="page">`) with:

```html
<app-public-header />

<main class="page">
  <h1 class="page-title">Help &amp; FAQ</h1>
  <p class="page-subtitle">
    Answers for patients checking a queue, and a walkthrough for staff running one.
  </p>

  @if (sectionCount() > 1) {
    <nav class="jump-nav">
      <a href="#patients">For patients</a>
      <a href="#staff">For staff{{ isAdmin() ? ' & admins' : '' }}</a>
    </nav>
  }

  <section id="patients" class="surface-card faq-section">
    <h2>For patients</h2>
    <mat-accordion multi>
      @for (item of patientFaqs; track item.q) {
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>{{ item.q }}</mat-panel-title>
          </mat-expansion-panel-header>
          <p>{{ item.a }}</p>
        </mat-expansion-panel>
      }
    </mat-accordion>
  </section>

  @if (showStaffSection()) {
    <section id="staff" class="surface-card faq-section">
      <h2>For staff{{ isAdmin() ? ' & admins' : '' }}</h2>
      <mat-accordion multi>
        @for (item of staffFaqs; track item.q) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>{{ item.q }}</mat-panel-title>
            </mat-expansion-panel-header>
            <p>{{ item.a }}</p>
          </mat-expansion-panel>
        }
        @for (item of adminFaqs(); track item.q) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>{{ item.q }}</mat-panel-title>
            </mat-expansion-panel-header>
            <p>{{ item.a }}</p>
          </mat-expansion-panel>
        }
      </mat-accordion>
    </section>
  } @else if (showPendingNotice()) {
    <div class="empty-state surface-card">
      <mat-icon>hourglass_top</mat-icon>
      <h3>Waiting for approval</h3>
      <p>
        Your account is set up, but an administrator has to let it through before the console
        guide applies to you.
      </p>
    </div>
  } @else if (showSignInCallout()) {
    <div class="signin-callout surface-card">
      <mat-icon>lock</mat-icon>
      <div>
        <h3>Running a queue?</h3>
        <p>Sign in as staff to see the console guide.</p>
      </div>
      <a mat-stroked-button routerLink="/login">Staff sign in</a>
    </div>
  }
</main>
```

Append to `help-page.scss`:

```scss
.jump-nav {
  display: flex;
  gap: 10px;
  margin: 4px 0 28px;

  a {
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid var(--app-border);
    color: var(--mat-sys-on-surface-variant);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;

    &:hover {
      color: var(--mat-sys-primary);
      border-color: var(--mat-sys-primary);
    }
  }
}

.signin-callout {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;

  mat-icon {
    flex: none;
    width: 26px;
    height: 26px;
    font-size: 26px;
    color: var(--mat-sys-primary);
  }

  h3 {
    margin: 0 0 2px;
    font-size: 1rem;
    font-weight: 650;
  }

  p {
    margin: 0;
    color: var(--mat-sys-on-surface-variant);
    font-size: 0.88rem;
  }

  a {
    margin-left: auto;
  }
}
```

- [ ] **Step 4: Run tests to verify they all pass**

Run: `npx ng test --include='**/help-page.spec.ts'`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/public/help-page.ts src/app/public/help-page.html src/app/public/help-page.scss src/app/public/help-page.spec.ts
git commit -m "feat: add staff/admin guide section and auth-state fallbacks to /help"
```

---

### Task 3: `PublicHeader` — Help link and role-aware button

**Files:**
- Modify: `src/app/shared/public-header.ts`
- Create: `src/app/shared/public-header.spec.ts`

**Interfaces:**
- Produces: `PublicHeader.isSignedIn: Signal<boolean>` (re-exposed from `AuthService`). No other
  file reads this — `console-shell.html` (Task 4) does not import `PublicHeader`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/shared/public-header.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PublicHeader } from './public-header';

function fakeAuth(isSignedIn: boolean) {
  return { isSignedIn: signal(isSignedIn) } as unknown as AuthService;
}

describe('PublicHeader', () => {
  async function render(auth: AuthService) {
    await TestBed.configureTestingModule({
      imports: [PublicHeader],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(PublicHeader);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a Help link and "Staff sign in" when signed out', async () => {
    const fixture = await render(fakeAuth(false));
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Help');
    expect(text).toContain('Staff sign in');
    expect(fixture.nativeElement.querySelector('a[href="/help"]')).not.toBeNull();
  });

  it('shows "Console" instead of "Staff sign in" when signed in', async () => {
    const fixture = await render(fakeAuth(true));
    expect(fixture.nativeElement.textContent).toContain('Console');
    expect(fixture.nativeElement.textContent).not.toContain('Staff sign in');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include='**/public-header.spec.ts'`
Expected: FAIL — no Help link, button always reads "Staff sign in", `AuthService` not injected yet.

- [ ] **Step 3: Update the component**

```typescript
// src/app/shared/public-header.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <a class="brand" routerLink="/">
        <span class="mark"><mat-icon>graphic_eq</mat-icon></span>
        <span class="name">Doctor<b>Q</b></span>
      </a>
      <div class="actions">
        <a mat-button routerLink="/help">
          <mat-icon>help_outline</mat-icon>
          Help
        </a>
        @if (isSignedIn()) {
          <a mat-stroked-button routerLink="/console">
            <mat-icon>dashboard</mat-icon>
            Console
          </a>
        } @else {
          <a mat-stroked-button routerLink="/console">
            <mat-icon>lock</mat-icon>
            Staff sign in
          </a>
        }
      </div>
    </header>
  `,
  styles: `
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 24px;
      background: color-mix(in srgb, var(--mat-sys-surface) 82%, transparent);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--app-border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: inherit;
    }

    .mark {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    .mark mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }

    .name {
      font-size: 1.15rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .name b {
      color: var(--mat-sys-primary);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `,
})
export class PublicHeader {
  private readonly auth = inject(AuthService);
  readonly isSignedIn = this.auth.isSignedIn;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include='**/public-header.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/public-header.ts src/app/shared/public-header.spec.ts
git commit -m "feat: add Help link and role-aware sign-in button to PublicHeader"
```

---

### Task 4: `console-shell` — Help & FAQ sidenav link

**Files:**
- Modify: `src/app/console/console-shell.html:42-46` (the `sidenav-foot`, next to the existing
  "View public board" link)
- Create: `src/app/console/console-shell.spec.ts`

**Interfaces:**
- Consumes: `ConsoleShell` as built today (`src/app/console/console-shell.ts`) — no changes to
  that file in this task, only its template.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/console/console-shell.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';
import { SettingsService } from '../core/settings.service';
import { UsersService } from '../core/users.service';
import { DEFAULT_ACCESS_SETTINGS } from '../core/models';
import { ConsoleShell } from './console-shell';

describe('ConsoleShell', () => {
  it('links to /help from the sidenav footer', async () => {
    const fakeAuth = {
      user: signal({ uid: 'u1', email: 'a@b.com', displayName: 'A', role: 'admin', doctorIds: [] }),
      isAdmin: signal(true),
      isApproved: signal(true),
    } as unknown as AuthService;
    const fakeDirectory = {
      myDoctors$: of([]),
      pendingDoctors$: of([]),
      pendingHospitals$: of([]),
    } as unknown as DirectoryService;
    const fakeUsers = { pendingUsers$: of([]) } as unknown as UsersService;
    const fakeSettings = {
      settings: signal(DEFAULT_ACCESS_SETTINGS),
    } as unknown as SettingsService;

    await TestBed.configureTestingModule({
      imports: [ConsoleShell],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuth },
        { provide: DirectoryService, useValue: fakeDirectory },
        { provide: UsersService, useValue: fakeUsers },
        { provide: SettingsService, useValue: fakeSettings },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConsoleShell);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[href="/help"]');
    expect(link).not.toBeNull();
    expect(link.textContent).toContain('Help');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='**/console-shell.spec.ts'`
Expected: FAIL — no `a[href="/help"]` in the sidenav footer yet.

- [ ] **Step 3: Add the link**

In `console-shell.html`, add the new link immediately before the existing "View public board"
link (both live in `.sidenav-foot`):

```html
      <a class="board-link" routerLink="/help">
        <mat-icon>help_outline</mat-icon>
        <span>Help &amp; FAQ</span>
      </a>

      <a class="board-link" routerLink="/" target="_blank" rel="noopener">
        <mat-icon>open_in_new</mat-icon>
        <span>View public board</span>
      </a>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='**/console-shell.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/console/console-shell.html src/app/console/console-shell.spec.ts
git commit -m "feat: add Help & FAQ link to the console sidenav"
```

---

## Final check

- [ ] Run the full test suite: `npx ng test` — expect all specs (the ones added here; there are
  no pre-existing specs in this repo) to pass.
- [ ] Run `npx ng build` to confirm the new route compiles into its own lazy chunk and the app
  builds cleanly.
- [ ] Manually visit `/help` signed out, signed in as `staff@doctorq.test`, and signed in as
  `admin@doctorq.test` (seeded by `npm run seed`) to confirm the three states render as designed.
