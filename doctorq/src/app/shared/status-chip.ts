import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { QueueStatus } from '../core/models';

/** Single source of truth for how a queue's status looks and reads to a patient. */
@Component({
  selector: 'app-status-chip',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip" [class]="status()">
      <mat-icon>{{ icon() }}</mat-icon>
      <span>{{ label() }}</span>
    </span>
  `,
  styles: `
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px 5px 9px;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
    }

    mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }

    .open {
      color: var(--status-open);
      background: var(--status-open-bg);
    }
    .paused {
      color: var(--status-paused);
      background: var(--status-paused-bg);
    }
    .cutoff {
      color: var(--status-cutoff);
      background: var(--status-cutoff-bg);
    }
    .closed {
      color: var(--status-closed);
      background: var(--status-closed-bg);
    }
  `,
})
export class StatusChip {
  readonly status = input.required<QueueStatus>();
  /** Set when the cap is reached but the status still says open. */
  readonly full = input(false);

  readonly label = computed(() => {
    if (this.full() && this.status() === 'open') return 'No slots left';
    return {
      open: 'Accepting patients',
      paused: 'Paused',
      cutoff: 'Cut-off — no new patients',
      closed: 'Clinic closed',
    }[this.status()];
  });

  readonly icon = computed(
    () =>
      ({
        open: 'check_circle',
        paused: 'pause_circle',
        cutoff: 'do_not_disturb_on',
        closed: 'cancel',
      })[this.status()],
  );
}
