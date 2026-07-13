import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { DirectoryService } from '../core/directory.service';
import { QueueBoardEntry } from '../core/models';
import { QueueService } from '../core/queue.service';
import { PublicHeader } from '../shared/public-header';
import { StatusChip } from '../shared/status-chip';

@Component({
  selector: 'app-queue-board',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    PublicHeader,
    StatusChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './queue-board.html',
  styleUrl: './queue-board.scss',
})
export class QueueBoard {
  private readonly queue = inject(QueueService);
  private readonly directory = inject(DirectoryService);

  private readonly entries = toSignal(this.queue.board$);
  readonly hospitals = toSignal(this.directory.hospitals$, { initialValue: [] });

  readonly search = signal('');
  readonly hospitalFilter = signal<string>('all');

  readonly loading = computed(() => this.entries() === undefined);
  readonly today = new Date();

  readonly visible = computed<QueueBoardEntry[]>(() => {
    const term = this.search().trim().toLowerCase();
    const hospitalId = this.hospitalFilter();
    return (this.entries() ?? []).filter((e) => {
      if (hospitalId !== 'all' && e.session.hospitalId !== hospitalId) return false;
      if (!term) return true;
      return [e.doctor?.fullName, e.doctor?.specialty, e.hospital?.name, e.hospital?.city]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(term));
    });
  });

  readonly openCount = computed(() => this.visible().filter((e) => e.acceptingNewPatients).length);

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

  waitLabel(minutes: number): string {
    if (minutes <= 0) return 'No wait';
    if (minutes < 60) return `~${minutes} min wait`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `~${hours}h ${rest}m wait` : `~${hours}h wait`;
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
