import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { QueueService } from '../core/queue.service';
import { LiveNumber } from '../shared/live-number';
import { PublicHeader } from '../shared/public-header';
import { StatusChip } from '../shared/status-chip';

const ADVICE_FADE = trigger('adviceFade', [
  transition('* => *', [style({ opacity: 0.25 }), animate('220ms ease', style({ opacity: 1 }))]),
]);

@Component({
  selector: 'app-queue-detail',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LiveNumber,
    PublicHeader,
    StatusChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [ADVICE_FADE],
  templateUrl: './queue-detail.html',
  styleUrl: './queue-detail.scss',
})
export class QueueDetail {
  private readonly queue = inject(QueueService);

  /** Bound from the :id route param via withComponentInputBinding-free `input()` on the route. */
  readonly id = input.required<string>();

  /**
   * Wrapped in `{ entry }` because `entry$` legitimately emits `undefined` for a queue that
   * doesn't exist — without the wrapper, `toSignal`'s own "nothing has arrived yet" sentinel
   * (also `undefined`) would be indistinguishable from that answer, and `loading` below would
   * never turn false for a bad id.
   */
  private readonly entryQuery = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => this.queue.entry$(id)),
      map((entry) => ({ entry })),
    ),
  );

  readonly loading = computed(() => this.entryQuery() === undefined);
  readonly entry = computed(() => this.entryQuery()?.entry);
  readonly today = new Date();

  readonly prefersReducedMotion =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  /**
   * The advice line — the whole reason a patient opens this page before travelling.
   */
  readonly advice = computed(() => {
    const e = this.entry();
    if (!e) return null;
    const { session, acceptingNewPatients, slotsLeft, waiting, estimatedWaitMinutes } = e;

    if (session.status === 'closed') {
      return {
        tone: 'closed' as const,
        title: 'This clinic has closed for today',
        body: 'No further patients are being seen. Please come back on the next clinic day.',
      };
    }
    if (session.status === 'cutoff' || slotsLeft === 0) {
      return {
        tone: 'cutoff' as const,
        title: 'Cut-off reached — no new patients today',
        body: `Every slot for today has been handed out. If you do not already hold a number, don't travel to the hospital — you will not be seen.`,
      };
    }
    if (session.status === 'paused') {
      return {
        tone: 'paused' as const,
        title: 'The queue is paused',
        body: 'The doctor has stepped away. Numbers already issued keep their place — new numbers are on hold.',
      };
    }
    if (!acceptingNewPatients) {
      return {
        tone: 'cutoff' as const,
        title: 'Not accepting new patients',
        body: 'Check with the front desk before travelling.',
      };
    }
    return {
      tone: 'open' as const,
      title: 'Still accepting patients',
      body: waiting
        ? `${waiting} ${waiting === 1 ? 'person is' : 'people are'} ahead of the last number issued, roughly ${estimatedWaitMinutes} minutes of queue.`
        : 'There is no queue right now — you would be seen shortly after arriving.',
    };
  });

  initials(name = ''): string {
    return (
      name
        .replace(/^dr\.?\s+/i, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  mapsUrl(address: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
}
