import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';
import { Doctor } from '../core/models';
import { confirmDialog, formDialog } from '../shared/dialog';
import { ConfirmDialog } from './confirm-dialog';
import { DoctorDialog } from './doctor-dialog';

@Component({
  selector: 'app-doctors-page',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './doctors-page.html',
  styleUrl: './directory-page.scss',
})
export class DoctorsPage {
  private readonly directory = inject(DirectoryService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  // Scoped: staff see the doctors they created, plus any an admin has handed them.
  readonly doctors = toSignal(this.directory.myDoctors$, { initialValue: [] as Doctor[] });
  private readonly hospitals = toSignal(this.directory.hospitals$, { initialValue: [] });
  private readonly ownedIds = toSignal(this.directory.myOwnedDoctorIds$, {
    initialValue: new Set<string>(),
  });

  readonly isAdmin = this.auth.isAdmin;
  readonly columns = ['doctor', 'specialty', 'hospitals', 'licence', 'actions'];
  readonly hasHospitals = computed(() => this.hospitals().length > 0);

  /** Deleting is the owner's call (or an admin's) — not something a borrowed doctor allows. */
  canDelete(doctor: Doctor): boolean {
    return this.isAdmin() || this.ownedIds().has(doctor.id);
  }

  /** A doctor handed over by an admin: editable, but not yours to re-point or remove. */
  isAssignedNotOwned(doctor: Doctor): boolean {
    return !this.isAdmin() && !this.ownedIds().has(doctor.id);
  }

  /** Added while the approval gate was on: not on the public board, and no queue can be opened. */
  isPending(doctor: Doctor): boolean {
    return doctor.approved === false;
  }

  hospitalNames(ids: string[] = []): string {
    const names = ids
      .map((id) => this.hospitals().find((h) => h.id === id)?.name)
      .filter((name): name is string => !!name);
    return names.length ? names.join(', ') : '—';
  }

  initials(name = ''): string {
    return (
      name
        .replace(/^dr\.?\s+/i, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  add(): void {
    this.dialog.open(DoctorDialog, formDialog());
  }

  edit(doctor: Doctor): void {
    this.dialog.open(DoctorDialog, formDialog(doctor));
  }

  async remove(doctor: Doctor): Promise<void> {
    const confirmed = await this.dialog
      .open(
        ConfirmDialog,
        confirmDialog({
          title: `Remove ${doctor.fullName}?`,
          body: 'The profile disappears from the public board. Any queue already open for this doctor keeps running until you delete it.',
          confirm: 'Remove doctor',
          destructive: true,
        }),
      )
      .afterClosed()
      .toPromise();

    if (!confirmed) return;
    try {
      await this.directory.deleteDoctor(doctor.id);
      this.snack.open(`${doctor.fullName} removed.`, 'Dismiss');
    } catch {
      this.snack.open('Could not remove the doctor.', 'Dismiss');
    }
  }
}
