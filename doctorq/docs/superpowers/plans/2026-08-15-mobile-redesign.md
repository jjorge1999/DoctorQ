# Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public queue board/detail pages and the staff console feel modern, minimalist, functional, and interactive on phones, with high-impact animation (odometer-style live numbers, native page-morph transitions, choreographed list/status animations) as the centerpiece.

**Architecture:** CSS-first responsiveness (matching this app's existing all-`@media`-query approach — no `BreakpointObserver`), plus a small number of new, independently-testable shared pieces (`LiveNumber`, `SwipeReveal`, `HospitalFilterSheet`) wired into the existing `queue-board`, `queue-detail`, `console-shell`, and `queue-control` components.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Angular Material 22, `@angular/animations` (new dependency added in Task 1), native browser View Transitions API via Angular Router's `withViewTransitions()`, Vitest + Angular TestBed (via the `@angular/build:unit-test` builder, `ng test`).

## Global Constraints

- No new dependencies beyond `@angular/animations` (spec: "Approach"). Everything else (bottom sheets, view transitions) uses packages/APIs already available.
- No Firestore/rules/data-model changes (spec: "Scope").
- `prefers-reduced-motion: reduce` must be honoured by every new animation (spec: "Testing").
- Breakpoints: 900px for structural layout collapse (existing convention — console sidenav, queue-detail two-column), 768px (new) only for the board's search/filter compaction (spec: "Breakpoints" note).
- Every new shared component/directive must be independently testable with no Firestore/Firebase mocking beyond what's listed in its own task.
- Rollout ends with `npm run build` then `wrangler pages deploy dist/doctorq/browser --project-name=doctorq` (spec: "Rollout").

---

## File Structure

**New files:**
- `src/app/shared/live-number.ts` + `.spec.ts` — odometer-style animated number display, used everywhere a live queue number appears.
- `src/app/shared/swipe-reveal.ts` + `.spec.ts` — swipe-to-reveal-actions directive for console queue cards.
- `src/app/public/hospital-filter-sheet.ts` + `.spec.ts` — `MatBottomSheet` content component for the board's mobile hospital picker.
- `src/app/console/more-nav-sheet.ts` — `MatBottomSheet` content component for the console bottom tab bar's overflow "More" tab.
- `src/app/public/queue-board.spec.ts`, `src/app/public/queue-detail.spec.ts`, `src/app/console/queue-control.spec.ts` — first specs for these components (only covering the new behaviour this plan adds, not retroactive full coverage).

**Modified files:**
- `package.json` — add `@angular/animations`.
- `src/app/app.config.ts` — `provideAnimationsAsync()`, `withViewTransitions()`.
- `src/app/public/queue-board.ts` / `.html` / `.scss` — `LiveNumber`, sticky search + bottom sheet filter, card stagger animation, press feedback, view-transition name.
- `src/app/public/queue-detail.ts` / `.html` / `.scss` — `LiveNumber`, status advice cross-fade, view-transition name.
- `src/app/console/console-shell.ts` / `.html` / `.scss` — bottom tab bar with sliding indicator, mobile top bar, "More" sheet.
- `src/app/console/queue-control.ts` / `.html` / `.scss` — `LiveNumber`, `SwipeReveal`, press feedback, vibration.
- `src/styles.scss` — shared press-feedback utility, reduced-motion audit.

---

### Task 1: Animation foundation — `@angular/animations` + native page transitions

**Files:**
- Modify: `package.json`
- Modify: `src/app/app.config.ts`

**Interfaces:**
- Produces: `provideAnimationsAsync()` registered application-wide (later tasks' `animations: [...]` component metadata and `[@trigger]` template bindings depend on this being present, or they throw `NG0908` at runtime).
- Produces: native View Transitions enabled on the router (later tasks add `view-transition-name` bindings that depend on this).

- [ ] **Step 1: Add the dependency**

```bash
npm install @angular/animations@^22.0.0
```

- [ ] **Step 2: Wire the providers**

Edit `src/app/app.config.ts`:

```ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { provideFirebase } from './core/firebase';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withViewTransitions(),
    ),
    provideFirebase(environment.firebase, environment.useEmulators),
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-rounded' } },
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: { duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom' },
    },
  ],
};
```

- [ ] **Step 3: Verify (no meaningful unit boundary for provider registration alone — verify by running the app)**

```bash
npm run build
```

Expected: build succeeds with no new errors.

```bash
npm start
```

Open `http://localhost:4200`, open the "Hospital" dropdown on the board. Before this task it snapped open instantly (no animations module was registered at all); it should now visibly slide/fade open. Click a clinic card — the page should navigate (a plain fade is fine for now; the shared-element morph comes in Task 6).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/app/app.config.ts
git commit -m "feat: enable angular animations and native view transitions"
```

---

### Task 2: `<app-live-number>` — the odometer-style live number component

**Files:**
- Create: `src/app/shared/live-number.ts`
- Create: `src/app/shared/live-number.spec.ts`

**Interfaces:**
- Produces: `LiveNumber` standalone component, selector `app-live-number`, one input `value: number`. Consumed by Tasks 3 and 9 as `<app-live-number [value]="someNumber" />`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/shared/live-number.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LiveNumber } from './live-number';

@Component({
  imports: [LiveNumber],
  template: `<app-live-number [value]="value()" />`,
})
class HostComponent {
  readonly value = signal(0);
}

describe('LiveNumber', () => {
  it('renders one digit column per digit of the value', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(42);
    fixture.detectChanges();

    const tracks = fixture.nativeElement.querySelectorAll('.digit-track');
    expect(tracks.length).toBe(2);
  });

  it('positions each digit column to show the current digit', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(7);
    fixture.detectChanges();

    const col = fixture.nativeElement.querySelector('.digit-col') as HTMLElement;
    expect(col.style.transform).toBe('translateY(calc(-7 * 1.2em))');
  });

  it('handles a value of zero as a single "0" digit', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(0);
    fixture.detectChanges();

    const tracks = fixture.nativeElement.querySelectorAll('.digit-track');
    expect(tracks.length).toBe(1);
    expect(tracks[0].textContent).toContain('0');
  });

  it('does not flash on first render', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(5);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('.live-number') as HTMLElement;
    expect(el.classList.contains('flash')).toBe(false);
  });

  it('flashes when the value changes after the initial render, then clears', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(5);
    fixture.detectChanges();

    fixture.componentInstance.value.set(6);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('.live-number') as HTMLElement;
    expect(el.classList.contains('flash')).toBe(true);

    vi.advanceTimersByTime(520);
    fixture.detectChanges();
    expect(el.classList.contains('flash')).toBe(false);

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- --watch=false
```

Expected: FAIL — `live-number.ts` does not exist yet.

- [ ] **Step 3: Implement `LiveNumber`**

Create `src/app/shared/live-number.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';

const DIGIT_RANGE = Array.from({ length: 10 }, (_, i) => i);
const FLASH_DURATION_MS = 520;

/**
 * A slot-machine/odometer-style number display. Every digit lives in its own fixed-height,
 * overflow-hidden column; changing the value slides the affected columns to the new digit and
 * briefly flashes colour across the whole number. Knows nothing about queues or Firestore —
 * feed it numbers.
 */
@Component({
  selector: 'app-live-number',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="live-number" [class.flash]="flashing()">
      @for (digit of digits(); track $index) {
        <span class="digit-track">
          <span class="digit-col" [style.transform]="'translateY(calc(-' + digit + ' * 1.2em))'">
            @for (n of digitRange; track n) {
              <span class="d">{{ n }}</span>
            }
          </span>
        </span>
      }
    </span>
  `,
  styles: `
    .live-number {
      display: inline-flex;
      font-variant-numeric: tabular-nums;
      font-feature-settings: 'tnum' 1;
    }

    .digit-track {
      height: 1.2em;
      overflow: hidden;
      line-height: 1.2em;
    }

    .digit-col {
      display: flex;
      flex-direction: column;
      transition: transform 480ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .d {
      height: 1.2em;
    }

    .flash .digit-track {
      animation: live-number-flash 520ms ease;
    }

    @keyframes live-number-flash {
      0% {
        color: var(--mat-sys-primary);
      }
      35% {
        color: color-mix(in srgb, var(--mat-sys-primary) 55%, var(--status-open));
      }
      100% {
        color: var(--mat-sys-primary);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .digit-col {
        transition: none;
      }

      .flash .digit-track {
        animation: none;
      }
    }
  `,
})
export class LiveNumber {
  readonly value = input.required<number>();
  readonly digitRange = DIGIT_RANGE;

  readonly digits = computed(() =>
    Array.from(String(Math.max(0, Math.trunc(this.value())))).map(Number),
  );

  readonly flashing = signal(false);

  private previousValue: number | null = null;
  private flashTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const current = this.value();
      const previous = this.previousValue;
      this.previousValue = current;

      if (previous === null || previous === current) return;

      clearTimeout(this.flashTimeout);
      this.flashing.set(true);
      this.flashTimeout = setTimeout(() => this.flashing.set(false), FLASH_DURATION_MS);
    });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- --watch=false
```

Expected: PASS — all 5 `LiveNumber` tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/live-number.ts src/app/shared/live-number.spec.ts
git commit -m "feat: add LiveNumber odometer-style live number component"
```

---

### Task 3: Wire `<app-live-number>` into the board card and console stats

**Files:**
- Modify: `src/app/public/queue-board.ts`, `src/app/public/queue-board.html`, `src/app/public/queue-board.scss`
- Modify: `src/app/console/queue-control.ts`, `src/app/console/queue-control.html`, `src/app/console/queue-control.scss`

**Interfaces:**
- Consumes: `LiveNumber` (Task 2), selector `app-live-number`, input `[value]`.

No new logic here — a presentational substitution, so this task is verified manually rather than with a new spec (per Task Right-Sizing: a task only needs its own test cycle where there's new logic to test).

- [ ] **Step 1: Board card — replace the "now serving" number**

In `src/app/public/queue-board.ts`, add the import and add `LiveNumber` to the component's `imports` array:

```ts
import { LiveNumber } from '../shared/live-number';
```

```ts
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    LiveNumber,
    PublicHeader,
    StatusChip,
  ],
```

In `src/app/public/queue-board.html`, replace:

```html
          <div class="now">
            <div class="now-label">Now serving</div>
            <div class="now-number numeral">
              @if (entry.session.nowServing > 0) {
                {{ entry.session.nowServing }}
              } @else {
                <span class="not-started">—</span>
              }
            </div>
```

with:

```html
          <div class="now">
            <div class="now-label">Now serving</div>
            <div class="now-number">
              @if (entry.session.nowServing > 0) {
                <app-live-number [value]="entry.session.nowServing" />
              } @else {
                <span class="not-started numeral">—</span>
              }
            </div>
```

In `src/app/public/queue-board.scss`, the `.now-number` rule keeps its font-size/weight/colour (those still apply, since `LiveNumber`'s root is `display: inline-flex` and inherits font styles from its container) — no change needed there.

- [ ] **Step 2: Console queue-control — replace "now serving" and the four metrics**

In `src/app/console/queue-control.ts`, add the import and add `LiveNumber` to `imports`:

```ts
import { LiveNumber } from '../shared/live-number';
```

```ts
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    LiveNumber,
    StatusChip,
  ],
```

In `src/app/console/queue-control.html`, replace:

```html
            <div class="serving">
              <span class="label">Now serving</span>
              <span class="value numeral">
                {{ entry.session.nowServing > 0 ? entry.session.nowServing : '—' }}
              </span>
            </div>

            <div class="metrics">
              <div>
                <span class="numeral">{{ entry.session.lastIssued }}</span>
                <small>Last issued</small>
              </div>
              <div>
                <span class="numeral">{{ entry.waiting }}</span>
                <small>Waiting</small>
              </div>
              <div>
                <span class="numeral">
                  {{ entry.slotsLeft === null ? '∞' : entry.slotsLeft }}
                </span>
                <small>Slots left</small>
              </div>
              <div>
                <span class="numeral">{{ entry.estimatedWaitMinutes }}m</span>
                <small>Est. wait</small>
              </div>
            </div>
```

with:

```html
            <div class="serving">
              <span class="label">Now serving</span>
              <span class="value">
                @if (entry.session.nowServing > 0) {
                  <app-live-number [value]="entry.session.nowServing" />
                } @else {
                  <span class="numeral">—</span>
                }
              </span>
            </div>

            <div class="metrics">
              <div>
                <app-live-number [value]="entry.session.lastIssued" />
                <small>Last issued</small>
              </div>
              <div>
                <app-live-number [value]="entry.waiting" />
                <small>Waiting</small>
              </div>
              <div>
                @if (entry.slotsLeft === null) {
                  <span class="numeral">∞</span>
                } @else {
                  <app-live-number [value]="entry.slotsLeft" />
                }
                <small>Slots left</small>
              </div>
              <div>
                <app-live-number [value]="entry.estimatedWaitMinutes" />m
                <small>Est. wait</small>
              </div>
            </div>
```

- [ ] **Step 3: Verify**

```bash
npm test -- --watch=false
```

Expected: PASS (existing `LiveNumber` tests still pass; no other specs exist yet for these files).

```bash
npm start
```

Open the board and `/console/queues` (sign in as `staff@doctorq.test` / `doctorq123` against the emulator, or use `npm run emulators` + `npm run seed` first if the emulator isn't already seeded). Confirm the numbers still display correctly and match what was there before.

- [ ] **Step 4: Commit**

```bash
git add src/app/public/queue-board.ts src/app/public/queue-board.html src/app/console/queue-control.ts src/app/console/queue-control.html
git commit -m "feat: use LiveNumber for board and console-control queue numbers"
```

---

### Task 4: Board — sticky search bar + hospital bottom sheet on mobile

**Files:**
- Create: `src/app/public/hospital-filter-sheet.ts`
- Create: `src/app/public/hospital-filter-sheet.spec.ts`
- Create: `src/app/public/queue-board.spec.ts`
- Modify: `src/app/public/queue-board.ts`, `src/app/public/queue-board.html`, `src/app/public/queue-board.scss`

**Interfaces:**
- Produces: `HospitalFilterSheet` component + `HospitalFilterSheetData` interface (`{ hospitals: Hospital[]; selected: string }`), dismisses with the chosen hospital id or `'all'`.
- Produces: `QueueBoard.openHospitalFilter()` and `QueueBoard.activeHospitalName` (consumed by the template added in this task).
- Consumes: `Hospital` from `../core/models` (existing).

- [ ] **Step 1: Write the failing tests for `HospitalFilterSheet`**

Create `src/app/public/hospital-filter-sheet.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { HospitalFilterSheet, HospitalFilterSheetData } from './hospital-filter-sheet';

describe('HospitalFilterSheet', () => {
  const data: HospitalFilterSheetData = {
    hospitals: [
      { id: 'h-1', name: "St. Luke's Medical Center", address: '', city: '' },
      { id: 'h-2', name: 'Makati Medical Center', address: '', city: '' },
    ],
    selected: 'all',
  };

  function setup(overrideData: HospitalFilterSheetData = data) {
    const dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: overrideData },
        { provide: MatBottomSheetRef, useValue: { dismiss } },
      ],
    });
    const fixture = TestBed.createComponent(HospitalFilterSheet);
    fixture.detectChanges();
    return { fixture, dismiss };
  }

  it('renders "All hospitals" plus one option per hospital', () => {
    const { fixture } = setup();
    const options = fixture.nativeElement.querySelectorAll('.option');
    expect(options.length).toBe(3);
  });

  it('marks the currently selected hospital', () => {
    const { fixture } = setup({ ...data, selected: 'h-2' });
    const selected = fixture.nativeElement.querySelector('.option.selected');
    expect(selected.textContent).toContain('Makati Medical Center');
  });

  it('dismisses with the chosen hospital id when an option is clicked', () => {
    const { fixture, dismiss } = setup();
    const options: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.option');
    options[2].click(); // Makati Medical Center
    expect(dismiss).toHaveBeenCalledWith('h-2');
  });

  it('dismisses with "all" when "All hospitals" is clicked', () => {
    const { fixture, dismiss } = setup({ ...data, selected: 'h-1' });
    const options: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.option');
    options[0].click();
    expect(dismiss).toHaveBeenCalledWith('all');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --watch=false
```

Expected: FAIL — `hospital-filter-sheet.ts` does not exist.

- [ ] **Step 3: Implement `HospitalFilterSheet`**

Create `src/app/public/hospital-filter-sheet.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Hospital } from '../core/models';

export interface HospitalFilterSheetData {
  hospitals: Hospital[];
  selected: string;
}

@Component({
  selector: 'app-hospital-filter-sheet',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet">
      <h2>Filter by hospital</h2>
      <button class="option" [class.selected]="data.selected === 'all'" (click)="choose('all')">
        <span>All hospitals</span>
        @if (data.selected === 'all') {
          <mat-icon>check</mat-icon>
        }
      </button>
      @for (hospital of data.hospitals; track hospital.id) {
        <button
          class="option"
          [class.selected]="data.selected === hospital.id"
          (click)="choose(hospital.id)"
        >
          <span>{{ hospital.name }}</span>
          @if (data.selected === hospital.id) {
            <mat-icon>check</mat-icon>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .sheet {
      display: flex;
      flex-direction: column;
      padding: 8px 8px calc(12px + env(safe-area-inset-bottom));
    }

    h2 {
      margin: 8px 12px 12px;
      font-size: 0.8rem;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--mat-sys-on-surface-variant);
    }

    .option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 12px;
      border: none;
      border-radius: 12px;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 0.94rem;
      text-align: left;
      cursor: pointer;
    }

    .option:active {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    .option.selected {
      color: var(--mat-sys-primary);
      font-weight: 650;
    }

    .option mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }
  `,
})
export class HospitalFilterSheet {
  private readonly ref = inject(MatBottomSheetRef<HospitalFilterSheet, string>);
  readonly data = inject<HospitalFilterSheetData>(MAT_BOTTOM_SHEET_DATA);

  choose(hospitalId: string): void {
    this.ref.dismiss(hospitalId);
  }
}
```

- [ ] **Step 4: Run to verify the sheet's tests pass**

```bash
npm test -- --watch=false
```

Expected: PASS — all 4 `HospitalFilterSheet` tests (plus the existing `LiveNumber` tests).

- [ ] **Step 5: Write the failing tests for `QueueBoard`'s new behaviour**

Create `src/app/public/queue-board.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { QueueBoard } from './queue-board';
import { QueueService } from '../core/queue.service';
import { DirectoryService } from '../core/directory.service';

describe('QueueBoard hospital filter', () => {
  const hospitals = [
    { id: 'h-1', name: "St. Luke's Medical Center", address: '', city: '' },
    { id: 'h-2', name: 'Makati Medical Center', address: '', city: '' },
  ];

  function setup(dismissedWith: string | undefined = undefined) {
    const open = vi.fn().mockReturnValue({ afterDismissed: () => of(dismissedWith) });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QueueService, useValue: { board$: of([]) } },
        { provide: DirectoryService, useValue: { hospitals$: of(hospitals) } },
        { provide: MatBottomSheet, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(QueueBoard);
    fixture.detectChanges();
    return { component: fixture.componentInstance, open };
  }

  it('opens the hospital filter sheet with the current hospitals and selection', () => {
    const { component, open } = setup();
    component.hospitalFilter.set('h-1');
    component.openHospitalFilter();

    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { hospitals, selected: 'h-1' } }),
    );
  });

  it('updates the hospital filter when the sheet is dismissed with a hospital id', () => {
    const { component } = setup('h-2');
    component.openHospitalFilter();
    expect(component.hospitalFilter()).toBe('h-2');
  });

  it('leaves the hospital filter unchanged when the sheet is dismissed with no selection', () => {
    const { component } = setup(undefined);
    component.hospitalFilter.set('h-1');
    component.openHospitalFilter();
    expect(component.hospitalFilter()).toBe('h-1');
  });

  it('computes the active hospital name for the filter chip', () => {
    const { component } = setup();
    component.hospitalFilter.set('h-2');
    expect(component.activeHospitalName()).toBe('Makati Medical Center');
  });
});
```

- [ ] **Step 6: Run to verify they fail**

```bash
npm test -- --watch=false
```

Expected: FAIL — `openHospitalFilter` / `activeHospitalName` do not exist on `QueueBoard`.

- [ ] **Step 7: Implement in `QueueBoard`**

In `src/app/public/queue-board.ts`, add imports:

```ts
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { HospitalFilterSheet } from './hospital-filter-sheet';
```

Add inside the class body (after the existing `hospitalFilter` signal):

```ts
  private readonly bottomSheet = inject(MatBottomSheet);

  readonly activeHospitalName = computed(
    () => this.hospitals().find((h) => h.id === this.hospitalFilter())?.name ?? '',
  );

  openHospitalFilter(): void {
    const ref = this.bottomSheet.open(HospitalFilterSheet, {
      data: { hospitals: this.hospitals(), selected: this.hospitalFilter() },
    });
    ref.afterDismissed().subscribe((hospitalId) => {
      if (hospitalId) this.hospitalFilter.set(hospitalId);
    });
  }
```

- [ ] **Step 8: Run to verify `QueueBoard` tests pass**

```bash
npm test -- --watch=false
```

Expected: PASS — all `QueueBoard` tests.

- [ ] **Step 9: Template + styles — sticky compact search on mobile, bottom sheet trigger**

In `src/app/public/queue-board.html`, replace the `.filters` block:

```html
    <div class="filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search doctor or specialty</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [value]="search()" (input)="onSearch($event)" placeholder="e.g. cardiology" />
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Hospital</mat-label>
        <mat-select [value]="hospitalFilter()" (valueChange)="hospitalFilter.set($event)">
          <mat-option value="all">All hospitals</mat-option>
          @for (hospital of hospitals(); track hospital.id) {
            <mat-option [value]="hospital.id">{{ hospital.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>
```

with:

```html
    <div class="filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
        <mat-label>Search doctor or specialty</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [value]="search()" (input)="onSearch($event)" placeholder="e.g. cardiology" />
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="hospital-field">
        <mat-label>Hospital</mat-label>
        <mat-select [value]="hospitalFilter()" (valueChange)="hospitalFilter.set($event)">
          <mat-option value="all">All hospitals</mat-option>
          @for (hospital of hospitals(); track hospital.id) {
            <mat-option [value]="hospital.id">{{ hospital.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <button class="hospital-filter-trigger" (click)="openHospitalFilter()">
        <mat-icon>tune</mat-icon>
        @if (hospitalFilter() !== 'all') {
          <span class="filter-chip">{{ activeHospitalName() }}</span>
        }
      </button>
    </div>
```

In `src/app/public/queue-board.scss`, replace the existing `@media (max-width: 600px)` block at the bottom with:

```scss
.hospital-filter-trigger {
  display: none;
}

@media (max-width: 767px) {
  .filters {
    position: sticky;
    top: 62px;
    z-index: 9;
    width: 100%;
    padding: 10px 0;
    background: color-mix(in srgb, var(--mat-sys-surface) 92%, transparent);
    backdrop-filter: blur(10px);
  }

  .search-field {
    flex: 1 1 auto;
  }

  .hospital-field {
    display: none;
  }

  .hospital-filter-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    height: 44px;
    padding: 0 14px;
    border: 1px solid var(--app-border);
    border-radius: 999px;
    background: var(--mat-sys-surface);
    color: var(--mat-sys-on-surface);
    font: inherit;

    &:active {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }
  }

  .filter-chip {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--mat-sys-primary);
  }

  // Condensed hero — the fold shouldn't be dominated by hero text before any clinic is visible.
  .hero {
    padding: 32px 20px 28px;
  }

  .hero-inner h1 {
    margin: 12px 0 8px;
    max-width: 22ch;
  }

  .hero-inner p {
    font-size: 0.92rem;
  }
}
```

- [ ] **Step 10: Verify in the browser**

```bash
npm start
```

At a phone-width viewport (e.g. browser dev tools device toolbar), confirm: the hero is visibly more compact (smaller heading, less padding) than at desktop width; the search bar sticks below the header while scrolling; the hospital dropdown is gone and replaced by a filter icon button; tapping it opens a bottom sheet with a "check" mark on the current selection; picking a different hospital filters the board and shows a chip with that hospital's name next to the filter button. At desktop width, confirm the original hero and inline filter layout are unchanged.

- [ ] **Step 11: Commit**

```bash
git add src/app/public/hospital-filter-sheet.ts src/app/public/hospital-filter-sheet.spec.ts src/app/public/queue-board.spec.ts src/app/public/queue-board.ts src/app/public/queue-board.html src/app/public/queue-board.scss
git commit -m "feat: mobile hospital filter bottom sheet and sticky search on the board"
```

---

### Task 5: Board — staggered card entrance, press feedback, reduced motion

**Files:**
- Modify: `src/app/public/queue-board.ts`, `src/app/public/queue-board.html`, `src/app/public/queue-board.scss`, `src/app/public/queue-board.spec.ts`

**Interfaces:**
- Produces: `QueueBoard.prefersReducedMotion: boolean` (read once at construction).

- [ ] **Step 1: Write the failing test**

Add to `src/app/public/queue-board.spec.ts` (new `describe` block, same file):

```ts
describe('QueueBoard reduced motion', () => {
  function setupWithMatchMedia(matches: boolean) {
    (globalThis as any).matchMedia = vi.fn().mockReturnValue({ matches });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QueueService, useValue: { board$: of([]) } },
        { provide: DirectoryService, useValue: { hospitals$: of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(QueueBoard);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('reads prefers-reduced-motion from matchMedia', () => {
    expect(setupWithMatchMedia(true).prefersReducedMotion).toBe(true);
  });

  it('defaults to false when the system has no preference', () => {
    expect(setupWithMatchMedia(false).prefersReducedMotion).toBe(false);
  });
});
```

Add `provideNoopAnimations()` to every `TestBed.configureTestingModule` providers array already in this file (the earlier `describe('QueueBoard hospital filter', ...)` block), since the component now binds an animation trigger:

```ts
import { provideNoopAnimations } from '@angular/platform-browser/animations';
```

```ts
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: QueueService, useValue: { board$: of([]) } },
        { provide: DirectoryService, useValue: { hospitals$: of(hospitals) } },
        { provide: MatBottomSheet, useValue: { open } },
      ],
```

(update both `setup()` helpers in the file — `hospital filter` block and the new `reduced motion` block — to include `provideNoopAnimations()`).

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --watch=false
```

Expected: FAIL — `prefersReducedMotion` does not exist yet; other tests may also fail with `NG0908` until the noop animations provider and the trigger both exist together (that's expected mid-step — proceed to implementation).

- [ ] **Step 3: Implement in `QueueBoard`**

In `src/app/public/queue-board.ts`, add imports:

```ts
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
```

Add above the `@Component` decorator:

```ts
const CARD_STAGGER = trigger('cardStagger', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(14px)' }),
        stagger(45, [
          animate(
            '340ms cubic-bezier(0.16, 1, 0.3, 1)',
            style({ opacity: 1, transform: 'translateY(0)' }),
          ),
        ]),
      ],
      { optional: true },
    ),
  ]),
]);
```

Add `animations: [CARD_STAGGER]` to the `@Component` decorator (alongside `imports`, `changeDetection`, etc.).

Add inside the class body:

```ts
  readonly prefersReducedMotion =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
```

- [ ] **Step 4: Run to verify `QueueBoard` tests pass**

```bash
npm test -- --watch=false
```

Expected: PASS — all `QueueBoard` tests, including the two new reduced-motion tests.

- [ ] **Step 5: Template + styles — bind the trigger and add press feedback**

In `src/app/public/queue-board.html`, change:

```html
    <div class="grid">
```

to:

```html
    <div class="grid" [@cardStagger]="visible().length" [@.disabled]="prefersReducedMotion">
```

In `src/app/public/queue-board.scss`, add to the existing `.card` rule's `&:hover` / `&:focus-visible` block:

```scss
  &:active {
    transform: scale(0.98);
    box-shadow: 0 4px 14px -10px rgb(0 0 0 / 0.4);
    transition-duration: 80ms;
  }
```

Add a reduced-motion override near the bottom of the file:

```scss
@media (prefers-reduced-motion: reduce) {
  .card:active {
    transform: none;
    opacity: 0.85;
  }
}
```

- [ ] **Step 6: Verify in the browser**

```bash
npm start
```

Reload the board — cards should fade/slide in with a slight stagger. Type in the search box to filter down to a subset, then clear it — the cards that (re)appear should stagger in again. Tap-and-hold a card on a touch-emulated viewport — it should visibly press down.

- [ ] **Step 7: Commit**

```bash
git add src/app/public/queue-board.ts src/app/public/queue-board.html src/app/public/queue-board.scss src/app/public/queue-board.spec.ts
git commit -m "feat: staggered card entrance and press feedback on the board"
```

---

### Task 6: Queue detail — status cross-fade + shared-element view transition

**Files:**
- Create: `src/app/public/queue-detail.spec.ts`
- Modify: `src/app/public/queue-detail.ts`, `src/app/public/queue-detail.html`
- Modify: `src/app/public/queue-board.html` (the matching view-transition-name on the board card)

**Interfaces:**
- Consumes: `entry.session.id` / `id()` (existing) as the shared key for `view-transition-name`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/public/queue-detail.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { QueueDetail } from './queue-detail';
import { QueueService } from '../core/queue.service';

describe('QueueDetail', () => {
  const entry = {
    session: {
      id: 'q-1',
      doctorId: 'd-1',
      hospitalId: 'h-1',
      date: '2026-08-15',
      status: 'open' as const,
      nowServing: 5,
      lastIssued: 8,
      maxSlots: 20,
      avgMinutesPerPatient: 10,
      startsAt: '09:00',
      endsAt: '15:00',
      note: '',
      updatedAt: Date.now(),
    },
    doctor: { id: 'd-1', fullName: 'Dr. Test', specialty: 'General', hospitalIds: ['h-1'] },
    hospital: { id: 'h-1', name: 'Test Hospital', address: '1 Test St', city: 'Testville' },
    waiting: 3,
    waitingNumbers: [6, 7, 8],
    slotsLeft: 12,
    acceptingNewPatients: true,
    estimatedWaitMinutes: 30,
  };

  function setup(matches = false) {
    (globalThis as any).matchMedia = vi.fn().mockReturnValue({ matches });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: QueueService, useValue: { entry$: () => of(entry) } },
      ],
    });
    const fixture = TestBed.createComponent(QueueDetail);
    fixture.componentRef.setInput('id', 'q-1');
    fixture.detectChanges();
    return fixture;
  }

  it('reads prefers-reduced-motion from matchMedia', () => {
    expect(setup(true).componentInstance.prefersReducedMotion).toBe(true);
  });

  it('defaults reduced-motion to false when the system has no preference', () => {
    expect(setup(false).componentInstance.prefersReducedMotion).toBe(false);
  });

  it('gives the display panel a view-transition-name matching the queue id', () => {
    const fixture = setup();
    const el = fixture.nativeElement.querySelector('.display') as HTMLElement;
    expect(el.style.getPropertyValue('view-transition-name')).toBe('queue-number-q-1');
  });

  it('renders the "open" advice tone for an accepting, non-cutoff queue', () => {
    const fixture = setup();
    const advice = fixture.nativeElement.querySelector('.advice');
    expect(advice.classList.contains('open')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --watch=false
```

Expected: FAIL — `prefersReducedMotion` doesn't exist, and `.display` has no `view-transition-name` yet.

- [ ] **Step 3: Implement in `QueueDetail`**

In `src/app/public/queue-detail.ts`, add imports:

```ts
import { animate, style, transition, trigger } from '@angular/animations';
```

Add above the `@Component` decorator:

```ts
const ADVICE_FADE = trigger('adviceFade', [
  transition('* => *', [style({ opacity: 0.25 }), animate('220ms ease', style({ opacity: 1 }))]),
]);
```

Add `animations: [ADVICE_FADE]` to the `@Component` decorator.

Add inside the class body:

```ts
  readonly prefersReducedMotion =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
```

- [ ] **Step 4: Template — bind the animation trigger and the view-transition name**

In `src/app/public/queue-detail.html`, change:

```html
        <div class="display surface-card">
```

to:

```html
        <div class="display surface-card" [style.view-transition-name]="'queue-number-' + id()">
```

Change:

```html
        @if (advice(); as a) {
          <div class="advice" [class]="a.tone">
```

to:

```html
        @if (advice(); as a) {
          <div class="advice" [class]="a.tone" [@adviceFade]="a.tone" [@.disabled]="prefersReducedMotion">
```

- [ ] **Step 5: Run to verify `QueueDetail` tests pass**

```bash
npm test -- --watch=false
```

Expected: PASS — all 4 `QueueDetail` tests.

- [ ] **Step 6: Give the board card the matching view-transition name**

In `src/app/public/queue-board.html`, change:

```html
          <div class="now">
```

to:

```html
          <div class="now" [style.view-transition-name]="'queue-number-' + entry.session.id">
```

- [ ] **Step 7: Add a matching test to `queue-board.spec.ts`**

Add to the `describe('QueueBoard hospital filter', ...)` block (or its own small block) in `src/app/public/queue-board.spec.ts`:

```ts
  it('gives each card a view-transition-name matching its queue id', () => {
    const boardEntry = {
      session: { id: 'q-9', hospitalId: 'h-1', nowServing: 1 },
      doctor: undefined,
      hospital: undefined,
      waiting: 0,
      acceptingNewPatients: true,
      slotsLeft: null,
      estimatedWaitMinutes: 0,
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: QueueService, useValue: { board$: of([boardEntry]) } },
        { provide: DirectoryService, useValue: { hospitals$: of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(QueueBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('.now') as HTMLElement;
    expect(el.style.getPropertyValue('view-transition-name')).toBe('queue-number-q-9');
  });
```

- [ ] **Step 8: Run to verify all board + detail tests pass**

```bash
npm test -- --watch=false
```

Expected: PASS.

- [ ] **Step 9: Verify in the browser**

```bash
npm start
```

In a Chromium-based browser, tap a clinic card on the board — the number panel should visibly morph into the detail page's number panel rather than a hard cut. In a browser without View Transitions support, confirm navigation still works (just an instant swap, no error). Change a queue's status from another tab/window signed into the console, and confirm the advice panel on the open detail page cross-fades to the new tone instead of snapping.

- [ ] **Step 10: Commit**

```bash
git add src/app/public/queue-detail.ts src/app/public/queue-detail.html src/app/public/queue-detail.spec.ts src/app/public/queue-board.html src/app/public/queue-board.spec.ts
git commit -m "feat: status cross-fade and shared-element view transition on queue detail"
```

---

### Task 7: Console shell — bottom tab bar with sliding indicator

**Files:**
- Create: `src/app/console/more-nav-sheet.ts`
- Create: `src/app/console/console-shell.spec.ts`
- Modify: `src/app/console/console-shell.ts`, `src/app/console/console-shell.html`, `src/app/console/console-shell.scss`

**Interfaces:**
- Produces: `ConsoleShell.primaryNav`, `.moreNav`, `.moreBadgeCount`, `.tabCount`, `.activeTabIndex`, `.openMoreNav()`.
- Produces: `MoreNavSheet` component + `MoreNavItem` interface (`{ path: string; icon: string; label: string; badge: number }`).

- [ ] **Step 1: Write the failing tests**

Create `src/app/console/console-shell.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { ConsoleShell } from './console-shell';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';
import { SettingsService } from '../core/settings.service';
import { UsersService } from '../core/users.service';
import { DEFAULT_ACCESS_SETTINGS } from '../core/models';

describe('ConsoleShell mobile navigation', () => {
  function setup({ isAdmin = false, url = '/console/queues', allowStaffHospitals = false } = {}) {
    const events$ = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal(null), isAdmin: signal(isAdmin), isApproved: signal(true) } },
        { provide: DirectoryService, useValue: { myDoctors$: of([]), pendingDoctors$: of([]), pendingHospitals$: of([]) } },
        { provide: UsersService, useValue: { pendingUsers$: of([]) } },
        { provide: SettingsService, useValue: { settings: signal({ ...DEFAULT_ACCESS_SETTINGS, allowStaffHospitals }) } },
      ],
    });
    const fixture = TestBed.createComponent(ConsoleShell);
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', { value: url, configurable: true });
    Object.defineProperty(router, 'events', { value: events$.asObservable(), configurable: true });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('puts queue/doctors/hospitals on the primary tab bar for staff without hospital access', () => {
    const shell = setup({ isAdmin: false, allowStaffHospitals: false });
    expect(shell.primaryNav().map((i) => i.path)).toEqual(['queues', 'doctors']);
    expect(shell.moreNav()).toEqual([]);
  });

  it('groups admin-only sections under "More" for an admin', () => {
    const shell = setup({ isAdmin: true });
    expect(shell.primaryNav().map((i) => i.path)).toEqual(['queues', 'doctors', 'hospitals']);
    expect(shell.moreNav().map((i) => i.path)).toEqual(['approvals', 'staff', 'settings']);
  });

  it('sizes the tab bar to include the More tab only when there is a More section', () => {
    expect(setup({ isAdmin: true }).tabCount()).toBe(4);
    expect(setup({ isAdmin: false }).tabCount()).toBe(2);
  });

  it('resolves the active tab index from the current route', () => {
    expect(setup({ isAdmin: true, url: '/console/doctors' }).activeTabIndex()).toBe(1);
  });

  it('parks the active index on the More tab when a More-only route is current', () => {
    expect(setup({ isAdmin: true, url: '/console/settings' }).activeTabIndex()).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --watch=false
```

Expected: FAIL — `primaryNav`, `moreNav`, `tabCount`, `activeTabIndex` don't exist yet.

- [ ] **Step 3: Implement in `ConsoleShell`**

In `src/app/console/console-shell.ts`, add imports:

```ts
import { toSignal } from '@angular/core/rxjs-interop'; // already imported — no change if present
import { NavigationEnd } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { filter, map } from 'rxjs';
import { MoreNavSheet } from './more-nav-sheet';
```

Add inside the class body, after the existing `nav` computed:

```ts
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly primaryPaths = ['queues', 'doctors', 'hospitals'];

  readonly primaryNav = computed(() =>
    this.nav().filter((item) => this.primaryPaths.includes(item.path)),
  );
  readonly moreNav = computed(() =>
    this.nav().filter((item) => !this.primaryPaths.includes(item.path)),
  );
  readonly moreBadgeCount = computed(() =>
    this.moreNav().reduce((sum, item) => sum + this.badgeFor(item.path), 0),
  );
  readonly tabCount = computed(() => this.primaryNav().length + (this.moreNav().length ? 1 : 0));

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly activeTabIndex = computed(() => {
    const url = this.currentUrl();
    const primary = this.primaryNav();
    const idx = primary.findIndex((item) => url.includes(`/console/${item.path}`));
    if (idx !== -1) return idx;
    return this.moreNav().some((item) => url.includes(`/console/${item.path}`)) ? primary.length : 0;
  });

  openMoreNav(): void {
    this.bottomSheet.open(MoreNavSheet, {
      data: this.moreNav().map((item) => ({ ...item, badge: this.badgeFor(item.path) })),
    });
  }
```

- [ ] **Step 4: Create `MoreNavSheet`**

Create `src/app/console/more-nav-sheet.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { RouterLink } from '@angular/router';

export interface MoreNavItem {
  path: string;
  icon: string;
  label: string;
  badge: number;
}

@Component({
  selector: 'app-more-nav-sheet',
  imports: [MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet">
      @for (item of items; track item.path) {
        <a [routerLink]="'/console/' + item.path" (click)="ref.dismiss()">
          <mat-icon>{{ item.icon }}</mat-icon>
          <span>{{ item.label }}</span>
          @if (item.badge) {
            <span class="badge">{{ item.badge }}</span>
          }
        </a>
      }
    </div>
  `,
  styles: `
    .sheet {
      display: flex;
      flex-direction: column;
      padding: 8px 8px calc(12px + env(safe-area-inset-bottom));
    }

    a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 12px;
      border-radius: 12px;
      color: inherit;
      text-decoration: none;
      font-size: 0.94rem;
    }

    a:active {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    .badge {
      margin-left: auto;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: var(--status-paused-bg);
      color: var(--status-paused);
      font-size: 0.7rem;
      font-weight: 700;
    }
  `,
})
export class MoreNavSheet {
  readonly ref = inject(MatBottomSheetRef<MoreNavSheet>);
  readonly items = inject<MoreNavItem[]>(MAT_BOTTOM_SHEET_DATA);
}
```

- [ ] **Step 5: Run to verify `ConsoleShell` tests pass**

```bash
npm test -- --watch=false
```

Expected: PASS — all 5 `ConsoleShell` tests.

- [ ] **Step 6: Template — bottom tab bar + mobile top bar**

In `src/app/console/console-shell.html`, replace the closing of `<mat-sidenav-content>` (the `@if (isApproved())` block stays; add a header above it) — change:

```html
  <mat-sidenav-content>
    @if (isApproved()) {
```

to:

```html
  <mat-sidenav-content>
    <header class="mobile-topbar">
      <button class="account" [matMenuTriggerFor]="menu" aria-label="Account menu">
        <span class="avatar">{{ initials(user()?.displayName || user()?.email) }}</span>
      </button>
      <span class="mobile-title">{{ isAdmin() ? 'Admin console' : 'Staff console' }}</span>
      <a class="board-link" routerLink="/" target="_blank" rel="noopener" aria-label="View public board">
        <mat-icon>open_in_new</mat-icon>
      </a>
    </header>

    @if (isApproved()) {
```

After the closing `</mat-sidenav-container>`, add the tab bar:

```html
</mat-sidenav-container>

<nav class="tabbar" [style.--tab-count]="tabCount()" [style.--active-index]="activeTabIndex()">
  <span class="indicator"></span>
  @for (item of primaryNav(); track item.path) {
    <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: false }">
      <mat-icon>{{ item.icon }}</mat-icon>
      <span>{{ item.label }}</span>
      @if (badgeFor(item.path); as count) {
        <span class="badge">{{ count }}</span>
      }
    </a>
  }
  @if (moreNav().length) {
    <button class="tab" (click)="openMoreNav()">
      <mat-icon>more_horiz</mat-icon>
      <span>More</span>
      @if (moreBadgeCount(); as count) {
        <span class="badge">{{ count }}</span>
      }
    </button>
  }
</nav>
```

- [ ] **Step 7: Styles — replace the icon-rail collapse with hide-sidebar + tab bar**

In `src/app/console/console-shell.scss`, replace the entire final block:

```scss
@media (max-width: 900px) {
  mat-sidenav {
    width: 76px;
    padding: 16px 10px;
  }

  .brand > div,
  nav a span,
  .board-link span,
  .scope,
  .who {
    display: none;
  }

  nav a,
  .board-link,
  .account {
    justify-content: center;
  }

  .account mat-icon {
    display: none;
  }
}
```

with:

```scss
.mobile-topbar {
  display: none;
}

.tabbar {
  display: none;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
}

@media (max-width: 899px) {
  mat-sidenav {
    display: none;
  }

  mat-sidenav-content {
    padding-bottom: calc(72px + env(safe-area-inset-bottom));
  }

  .mobile-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    position: sticky;
    top: 0;
    z-index: 15;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--mat-sys-surface) 92%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--app-border);

    .mobile-title {
      font-size: 0.95rem;
      font-weight: 650;
    }

    .account {
      width: 36px;
      height: 36px;
      padding: 0;
      border: none;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
      color: var(--mat-sys-primary);
      font-size: 0.8rem;
      font-weight: 650;
      cursor: pointer;
    }

    .board-link {
      display: grid;
      place-items: center;
      color: var(--mat-sys-on-surface-variant);
    }

    .board-link mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }
  }

  .tabbar {
    display: flex;
    align-items: stretch;
    gap: 2px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--mat-sys-surface) 94%, transparent);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--app-border);

    .indicator {
      position: absolute;
      top: 4px;
      bottom: 4px;
      left: calc((100% / var(--tab-count)) * var(--active-index));
      width: calc(100% / var(--tab-count));
      border-radius: 14px;
      background: color-mix(in srgb, var(--mat-sys-primary) 13%, transparent);
      transition: left 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 0;
    }

    a,
    .tab {
      position: relative;
      z-index: 1;
      flex: 1 1 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 4px;
      border: none;
      background: none;
      color: var(--mat-sys-on-surface-variant);
      font: inherit;
      font-size: 0.68rem;
      font-weight: 600;
      text-decoration: none;

      mat-icon {
        width: 22px;
        height: 22px;
        font-size: 22px;
      }

      &.active {
        color: var(--mat-sys-primary);
      }
    }

    .badge {
      position: absolute;
      top: 2px;
      right: 18%;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: var(--status-paused-bg);
      color: var(--status-paused);
      font-size: 0.62rem;
      font-weight: 700;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tabbar .indicator {
      transition: none;
    }
  }
}
```

- [ ] **Step 8: Verify in the browser**

```bash
npm start
```

At a phone-width viewport, sign into `/console` (emulator: `staff@doctorq.test` / `doctorq123` or `admin@doctorq.test` / `doctorq123`). Confirm: the sidebar is gone; a slim top bar with the account avatar, title, and "view board" icon is sticky at the top; a bottom tab bar shows Queue/Doctors(/Hospitals) plus "More" for an admin; switching tabs slides the highlighted pill to the new tab; tapping "More" opens a sheet with Approvals/Staff/Settings and their badge counts. At desktop width, confirm the original sidebar is unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/app/console/more-nav-sheet.ts src/app/console/console-shell.ts src/app/console/console-shell.html src/app/console/console-shell.scss src/app/console/console-shell.spec.ts
git commit -m "feat: bottom tab bar with sliding indicator for the console on mobile"
```

---

### Task 8: `SwipeReveal` directive

**Files:**
- Create: `src/app/shared/swipe-reveal.ts`
- Create: `src/app/shared/swipe-reveal.spec.ts`

**Interfaces:**
- Produces: `SwipeReveal` standalone directive, selector `[appSwipeReveal]`, `exportAs: 'appSwipeReveal'`. Public members: `open: Signal<boolean>`, `close(): void`. Consumed by Task 9.

- [ ] **Step 1: Write the failing tests**

Create `src/app/shared/swipe-reveal.spec.ts`:

```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwipeReveal } from './swipe-reveal';

@Component({
  imports: [SwipeReveal],
  template: `<div appSwipeReveal #swipe="appSwipeReveal"></div>`,
})
class HostComponent {}

function pointerEvent(clientX: number): PointerEvent {
  return { clientX } as PointerEvent;
}

describe('SwipeReveal', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const directive = fixture.debugElement.children[0].injector.get(SwipeReveal);
    return { directive };
  }

  it('starts closed with no transform offset', () => {
    const { directive } = setup();
    expect(directive.open()).toBe(false);
    expect(directive.transformStyle()).toBe('translateX(0px)');
  });

  it('follows the finger while dragging left, clamped to the reveal width', () => {
    const { directive } = setup();
    directive.onPointerDown(pointerEvent(300));
    directive.onPointerMove(pointerEvent(250));
    expect(directive.transformStyle()).toBe('translateX(-50px)');

    directive.onPointerMove(pointerEvent(0));
    expect(directive.transformStyle()).toBe('translateX(-148px)');
  });

  it('snaps open when released past half the reveal width', () => {
    const { directive } = setup();
    directive.onPointerDown(pointerEvent(300));
    directive.onPointerMove(pointerEvent(140));
    directive.onPointerEnd();

    expect(directive.open()).toBe(true);
    expect(directive.transformStyle()).toBe('translateX(-148px)');
  });

  it('snaps closed when released before half the reveal width', () => {
    const { directive } = setup();
    directive.onPointerDown(pointerEvent(300));
    directive.onPointerMove(pointerEvent(280));
    directive.onPointerEnd();

    expect(directive.open()).toBe(false);
    expect(directive.transformStyle()).toBe('translateX(0px)');
  });

  it('closes on demand, e.g. after a revealed action fires', () => {
    const { directive } = setup();
    directive.onPointerDown(pointerEvent(300));
    directive.onPointerMove(pointerEvent(140));
    directive.onPointerEnd();
    expect(directive.open()).toBe(true);

    directive.close();
    expect(directive.open()).toBe(false);
    expect(directive.transformStyle()).toBe('translateX(0px)');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --watch=false
```

Expected: FAIL — `swipe-reveal.ts` does not exist.

- [ ] **Step 3: Implement `SwipeReveal`**

Create `src/app/shared/swipe-reveal.ts`:

```ts
import { Directive, computed, signal } from '@angular/core';

export const SWIPE_REVEAL_WIDTH = 148;

/**
 * Swipe-left-to-reveal-actions for a card. Tracks the live drag offset while a pointer is down
 * and snaps open/closed on release, past/short of half the reveal width. `close()` is exposed for
 * a revealed action button to call after it fires, so the card snaps shut behind it.
 */
@Directive({
  selector: '[appSwipeReveal]',
  standalone: true,
  exportAs: 'appSwipeReveal',
  host: {
    '[style.transform]': 'transformStyle()',
    '[style.transition]': 'transitionStyle()',
    '[style.touch-action]': "'pan-y'",
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd()',
    '(pointercancel)': 'onPointerEnd()',
  },
})
export class SwipeReveal {
  readonly open = signal(false);
  private readonly liveOffset = signal<number | null>(null);
  private startX = 0;

  readonly transformStyle = computed(() => `translateX(${this.offset()}px)`);
  readonly transitionStyle = computed(() =>
    this.liveOffset() === null ? 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
  );

  private offset(): number {
    const live = this.liveOffset();
    if (live !== null) return live;
    return this.open() ? -SWIPE_REVEAL_WIDTH : 0;
  }

  onPointerDown(event: PointerEvent): void {
    this.startX = event.clientX;
    this.liveOffset.set(this.open() ? -SWIPE_REVEAL_WIDTH : 0);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.liveOffset() === null) return;
    const base = this.open() ? -SWIPE_REVEAL_WIDTH : 0;
    const raw = base + (event.clientX - this.startX);
    this.liveOffset.set(Math.min(0, Math.max(-SWIPE_REVEAL_WIDTH, raw)));
  }

  onPointerEnd(): void {
    const offset = this.liveOffset();
    if (offset === null) return;
    this.open.set(offset <= -SWIPE_REVEAL_WIDTH / 2);
    this.liveOffset.set(null);
  }

  close(): void {
    this.open.set(false);
    this.liveOffset.set(null);
  }
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npm test -- --watch=false
```

Expected: PASS — all 5 `SwipeReveal` tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/swipe-reveal.ts src/app/shared/swipe-reveal.spec.ts
git commit -m "feat: add SwipeReveal swipe-to-reveal-actions directive"
```

---

### Task 9: Queue control — swipe actions + vibration feedback

**Files:**
- Create: `src/app/console/queue-control.spec.ts`
- Modify: `src/app/console/queue-control.ts`, `src/app/console/queue-control.html`, `src/app/console/queue-control.scss`

**Interfaces:**
- Consumes: `SwipeReveal` (Task 8), `LiveNumber` (already imported in Task 3).
- Changes `QueueControl['run']` from `Promise<void>` to `Promise<boolean>` (resolves `true` on success) — internal to the class, no other file calls `run` directly.

- [ ] **Step 1: Write the failing tests**

Create `src/app/console/queue-control.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { QueueControl } from './queue-control';
import { QueueService } from '../core/queue.service';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';

describe('QueueControl vibration feedback', () => {
  const entry = {
    session: {
      id: 'q-1',
      doctorId: 'd-1',
      hospitalId: 'h-1',
      date: '2026-08-15',
      status: 'open' as const,
      nowServing: 5,
      lastIssued: 8,
      maxSlots: 20,
      avgMinutesPerPatient: 10,
      updatedAt: Date.now(),
    },
    doctor: undefined,
    hospital: undefined,
    waiting: 2,
    waitingNumbers: [6, 7],
    acceptingNewPatients: true,
    slotsLeft: 12,
    estimatedWaitMinutes: 20,
  };

  function setup(callNext = vi.fn().mockResolvedValue(undefined)) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: QueueService, useValue: { myBoard$: of([entry]), callNext } },
        { provide: AuthService, useValue: { isAdmin: () => false } },
        {
          provide: DirectoryService,
          useValue: { myApprovedDoctors$: of([]), myPendingDoctors$: of([]) },
        },
      ],
    });
    const fixture = TestBed.createComponent(QueueControl);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('vibrates once calling next succeeds, when the Vibration API is available', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(globalThis.navigator, 'vibrate', { value: vibrate, configurable: true });

    const component = setup();
    await component.callNext(entry as any);

    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('does not vibrate when calling next fails', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(globalThis.navigator, 'vibrate', { value: vibrate, configurable: true });

    const component = setup(vi.fn().mockRejectedValue(new Error('offline')));
    await component.callNext(entry as any);

    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not throw when the Vibration API does not exist, e.g. iOS Safari', async () => {
    Object.defineProperty(globalThis.navigator, 'vibrate', { value: undefined, configurable: true });

    const component = setup();
    await expect(component.callNext(entry as any)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --watch=false
```

Expected: FAIL — vibration isn't wired up, so `navigator.vibrate` is never called.

- [ ] **Step 3: Implement in `QueueControl`**

In `src/app/console/queue-control.ts`, change the `run` method's return type and success signalling:

```ts
  private async run(id: string, action: () => Promise<unknown>): Promise<boolean> {
    if (this.isBusy(id)) return false;
    this.pending.update((set) => new Set(set).add(id));
    try {
      await action();
      return true;
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : 'That action failed.', 'Dismiss');
      return false;
    } finally {
      this.pending.update((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }
  }
```

Change `callNext` and `callNumber` to vibrate on success:

```ts
  async callNext(entry: QueueBoardEntry): Promise<void> {
    const ok = await this.run(entry.session.id, () => this.queue.callNext(entry.session.id));
    if (ok) this.vibrate();
  }
```

```ts
    const ok = await this.run(entry.session.id, async () => {
      await this.queue.callNumber(entry.session.id, number);
      this.snack.open(`Now serving ${number}.`, 'Dismiss');
    });
    if (ok) this.vibrate();
  }
```

(the rest of `callNumber`'s confirmation-dialog logic above that line is unchanged.)

Add a private method at the bottom of the class:

```ts
  /** Progressive enhancement only — silently absent where the Vibration API doesn't exist (iOS Safari). */
  private vibrate(): void {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(10);
  }
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npm test -- --watch=false
```

Expected: PASS — all 3 vibration tests, plus the reduced-motion coverage remains green (no other suites touch `QueueControl` yet).

- [ ] **Step 5: Template — swipe-reveal wrapper around each queue card**

In `src/app/console/queue-control.ts`, add the import and add `SwipeReveal` to `imports`:

```ts
import { SwipeReveal } from '../shared/swipe-reveal';
```

```ts
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    LiveNumber,
    StatusChip,
    SwipeReveal,
  ],
```

In `src/app/console/queue-control.html`, change the opening of each card:

```html
        <article class="queue surface-card">
          <header>
```

to:

```html
        <article class="queue surface-card swipe-card">
          <div class="swipe-actions">
            <button
              class="swipe-action call"
              [disabled]="isBusy(entry.session.id) || entry.waiting === 0"
              (click)="callNext(entry); swipe.close()"
            >
              <mat-icon>skip_next</mat-icon>
              <span>Call next</span>
            </button>
            <button
              class="swipe-action pause"
              [disabled]="isBusy(entry.session.id) || entry.session.status === 'paused'"
              (click)="setStatus(entry, 'paused'); swipe.close()"
            >
              <mat-icon>pause_circle</mat-icon>
              <span>Pause</span>
            </button>
          </div>

          <div class="swipe-surface" appSwipeReveal #swipe="appSwipeReveal">
          <header>
```

and change the closing of each card:

```html
          @if (entry.session.note) {
            <p class="note">
              <mat-icon>campaign</mat-icon>
              {{ entry.session.note }}
            </p>
          }
        </article>
```

to:

```html
          @if (entry.session.note) {
            <p class="note">
              <mat-icon>campaign</mat-icon>
              {{ entry.session.note }}
            </p>
          }
          </div>
        </article>
```

(everything between `<header>` and this closing block — the `.body`, `.waiting-list`, and `<footer>` — is unchanged, just now nested one level deeper inside `.swipe-surface`.)

- [ ] **Step 6: Styles**

Add to `src/app/console/queue-control.scss`:

```scss
.swipe-card {
  position: relative;
  overflow: hidden;
  padding: 0;
}

.swipe-actions {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: flex-end;
}

.swipe-action {
  width: 74px;
  display: grid;
  place-items: center;
  gap: 2px;
  border: none;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 600;

  mat-icon {
    width: 22px;
    height: 22px;
    font-size: 22px;
  }

  &.call {
    background: var(--status-open);
  }

  &.pause {
    background: var(--status-paused);
  }

  &:disabled {
    opacity: 0.5;
  }
}

.swipe-surface {
  position: relative;
  z-index: 1;
  padding: 22px;
  background: var(--mat-sys-surface);
}
```

Add press feedback to the waiting-number chips and the footer action buttons (near the existing `.num-chip` and `footer button` rules):

```scss
.num-chip:active,
footer button:active {
  transform: scale(0.94);
}

@media (prefers-reduced-motion: reduce) {
  .num-chip:active,
  footer button:active {
    transform: none;
    opacity: 0.8;
  }
}
```

- [ ] **Step 7: Verify in the browser**

```bash
npm start
```

At a phone-width viewport in `/console/queues`, swipe a queue card left — two action buttons (Call next, Pause) should be revealed underneath, snapping fully open once dragged past half their combined width, or snapping shut if released early. Tapping either action should perform it and the card should snap shut. The existing `⋮` overflow menu should still work exactly as before regardless of touch support. On a phone or an Android emulator, calling a number should produce a very short vibration (not testable on desktop Chrome, which has no Vibration API).

- [ ] **Step 8: Commit**

```bash
git add src/app/console/queue-control.ts src/app/console/queue-control.html src/app/console/queue-control.scss src/app/console/queue-control.spec.ts
git commit -m "feat: swipe actions and vibration feedback on console queue cards"
```

---

### Task 10: Build, full test suite, and redeploy

**Files:** none (verification + deploy only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test -- --watch=false
```

Expected: PASS — every spec added across Tasks 2–9.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: succeeds, output at `dist/doctorq/browser`.

- [ ] **Step 3: Manual verification pass**

```bash
npm start
```

Using the browser's device toolbar at a phone width (and, if available, a real phone on the same network), walk through:
- Board: sticky search, hospital bottom sheet, staggered card entrance, press feedback, odometer roll on numbers that change (call a number from another signed-in console tab and watch the public board update live).
- Queue detail: shared-element morph on navigating from a card, status cross-fade if the status changes while open.
- Console: bottom tab bar + sliding indicator, "More" sheet, swipe actions on a queue card, odometer roll on the console's own numbers.
- Confirm `prefers-reduced-motion: reduce` (via OS/browser emulation) removes the odometer roll, stagger, flash, and swipe transition animations without breaking any interaction.
- Confirm desktop/tablet widths (≥900px for console, ≥768px for the board's filters) are visually unchanged from before this plan.

- [ ] **Step 4: Redeploy to Cloudflare Pages**

```bash
wrangler pages deploy dist/doctorq/browser --project-name=doctorq
```

Expected: deploy succeeds, printing a `*.doctorq.pages.dev` URL. Confirm `https://doctorq.pages.dev` reflects the changes (may take a few seconds to propagate).

- [ ] **Step 5: Commit** (only if Step 3 surfaced fixes — otherwise nothing to commit here)

```bash
git add -A
git commit -m "fix: address manual verification findings from mobile redesign pass"
```
