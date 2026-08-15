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
