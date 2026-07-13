import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';
import { QueueBoardEntry, QueueStatus } from '../core/models';
import { QueueService } from '../core/queue.service';
import { confirmDialog, formDialog } from '../shared/dialog';
import { StatusChip } from '../shared/status-chip';
import { ConfirmDialog } from './confirm-dialog';
import { QueueDialog } from './queue-dialog';

@Component({
  selector: 'app-queue-control',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    StatusChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './queue-control.html',
  styleUrl: './queue-control.scss',
})
export class QueueControl {
  private readonly queue = inject(QueueService);
  private readonly auth = inject(AuthService);
  private readonly directory = inject(DirectoryService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  // Scoped: staff see only the queues of the doctors assigned to them.
  private readonly entries = toSignal(this.queue.myBoard$);
  private readonly myDoctors = toSignal(this.directory.myApprovedDoctors$, { initialValue: [] });
  private readonly myPendingDoctors = toSignal(this.directory.myPendingDoctors$, {
    initialValue: [],
  });

  readonly loading = computed(() => this.entries() === undefined);
  readonly board = computed(() => this.entries() ?? []);
  readonly today = new Date();

  readonly isAdmin = this.auth.isAdmin;
  /** No doctor a queue could legally be opened for. */
  readonly hasNoDoctors = computed(() => this.myDoctors().length === 0);
  /** Distinguishes "you have nothing" from "yours is sitting in the admin's approval queue". */
  readonly awaitingApproval = computed(
    () => this.hasNoDoctors() && this.myPendingDoctors().length > 0,
  );

  /** Ids with an in-flight write, so buttons can't be double-fired. */
  private readonly pending = signal<ReadonlySet<string>>(new Set());
  isBusy(id: string): boolean {
    return this.pending().has(id);
  }

  readonly totals = computed(() => {
    const board = this.board();
    return {
      queues: board.length,
      waiting: board.reduce((sum, e) => sum + e.waiting, 0),
      open: board.filter((e) => e.acceptingNewPatients).length,
      served: board.reduce((sum, e) => sum + e.session.nowServing, 0),
    };
  });

  readonly statusOptions: { value: QueueStatus; icon: string; label: string }[] = [
    { value: 'open', icon: 'play_circle', label: 'Open — accepting patients' },
    { value: 'paused', icon: 'pause_circle', label: 'Pause — hold new numbers' },
    { value: 'cutoff', icon: 'do_not_disturb_on', label: 'Cut-off — no new patients' },
    { value: 'closed', icon: 'cancel', label: 'Close — clinic finished' },
  ];

  openQueueDialog(): void {
    this.dialog.open(QueueDialog, formDialog());
  }

  editQueue(entry: QueueBoardEntry): void {
    this.dialog.open(QueueDialog, formDialog({ session: entry.session }));
  }

  async issueNumber(entry: QueueBoardEntry): Promise<void> {
    await this.run(entry.session.id, async () => {
      const number = await this.queue.issueNumber(entry.session.id);
      this.snack.open(`Number ${number} issued to the patient.`, 'Dismiss');
    });
  }

  async callNext(entry: QueueBoardEntry): Promise<void> {
    await this.run(entry.session.id, () => this.queue.callNext(entry.session.id));
  }

  /**
   * Call a waiting number ahead of its turn — the emergency, or the patient whose turn was
   * missed. Confirmed when it actually jumps the queue, since patients holding lower numbers
   * are watching the same board.
   */
  async callNumber(entry: QueueBoardEntry, number: number): Promise<void> {
    const lowest = entry.waitingNumbers[0];
    if (number !== lowest) {
      const ahead = entry.waitingNumbers.filter((n) => n < number);
      const confirmed = await this.dialog
        .open(
          ConfirmDialog,
          confirmDialog({
            title: `Call number ${number} next?`,
            body: `${ahead.length} ${ahead.length === 1 ? 'patient is' : 'patients are'} ahead of it (${ahead.join(', ')}). They keep their place and stay in the queue, and the board will show that ${number} was called out of order.`,
            confirm: `Call ${number} next`,
          }),
        )
        .afterClosed()
        .toPromise();
      if (!confirmed) return;
    }

    await this.run(entry.session.id, async () => {
      await this.queue.callNumber(entry.session.id, number);
      this.snack.open(`Now serving ${number}.`, 'Dismiss');
    });
  }

  async callPrevious(entry: QueueBoardEntry): Promise<void> {
    await this.run(entry.session.id, () => this.queue.callPrevious(entry.session.id));
  }

  async setStatus(entry: QueueBoardEntry, status: QueueStatus): Promise<void> {
    await this.run(entry.session.id, () => this.queue.setStatus(entry.session.id, status));
  }

  async removeQueue(entry: QueueBoardEntry): Promise<void> {
    const confirmed = await this.dialog
      .open(
        ConfirmDialog,
        confirmDialog({
          title: 'Delete this queue?',
          body: `${entry.doctor?.fullName ?? 'This doctor'}'s queue at ${entry.hospital?.name ?? 'this hospital'} will disappear from the public board. Numbers already issued cannot be recovered.`,
          confirm: 'Delete queue',
          destructive: true,
        }),
      )
      .afterClosed()
      .toPromise();

    if (!confirmed) return;
    await this.run(entry.session.id, () => this.queue.deleteSession(entry.session.id));
  }

  private async run(id: string, action: () => Promise<unknown>): Promise<void> {
    if (this.isBusy(id)) return;
    this.pending.update((set) => new Set(set).add(id));
    try {
      await action();
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : 'That action failed.', 'Dismiss');
    } finally {
      this.pending.update((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }
  }
}
