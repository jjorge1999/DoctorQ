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
import { Hospital } from '../core/models';
import { SettingsService } from '../core/settings.service';
import { confirmDialog, formDialog } from '../shared/dialog';
import { ConfirmDialog } from './confirm-dialog';
import { HospitalDialog } from './hospital-dialog';

@Component({
  selector: 'app-hospitals-page',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hospitals-page.html',
  styleUrl: './directory-page.scss',
})
export class HospitalsPage {
  private readonly directory = inject(DirectoryService);
  private readonly auth = inject(AuthService);
  private readonly settingsService = inject(SettingsService);
  private readonly settings = this.settingsService.settings;
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly doctors = toSignal(this.directory.doctors$, { initialValue: [] });

  // Staff see approved hospitals plus their own submissions still waiting on an admin.
  private readonly all = toSignal(this.directory.allHospitals$, { initialValue: [] as Hospital[] });

  readonly isAdmin = this.auth.isAdmin;
  readonly columns = ['hospital', 'city', 'phone', 'doctors', 'actions'];

  readonly hospitals = computed(() => {
    const uid = this.auth.user()?.uid;
    return this.all().filter(
      (h) => this.isAdmin() || h.approved !== false || h.ownerUid === uid,
    );
  });

  /** Staff may add hospitals only while the admin leaves that gate open. */
  readonly canAdd = computed(() => this.isAdmin() || this.settings().allowStaffHospitals);

  /** An admin may edit any hospital; a staff member only the ones they submitted. */
  canEdit(hospital: Hospital): boolean {
    return this.isAdmin() || hospital.ownerUid === this.auth.user()?.uid;
  }

  isPending(hospital: Hospital): boolean {
    return hospital.approved === false;
  }

  doctorCount(hospitalId: string): number {
    return this.doctors().filter((d) => d.hospitalIds?.includes(hospitalId)).length;
  }

  add(): void {
    this.dialog.open(HospitalDialog, formDialog());
  }

  edit(hospital: Hospital): void {
    this.dialog.open(HospitalDialog, formDialog(hospital));
  }

  async remove(hospital: Hospital): Promise<void> {
    const attached = this.doctorCount(hospital.id);
    const confirmed = await this.dialog
      .open(
        ConfirmDialog,
        confirmDialog({
          title: `Remove ${hospital.name}?`,
          body: attached
            ? `${attached} doctor${attached === 1 ? '' : 's'} still list this hospital on their profile. Their queues here will lose the hospital details shown to patients.`
            : 'This hospital will no longer be available when opening a queue.',
          confirm: 'Remove hospital',
          destructive: true,
        }),
      )
      .afterClosed()
      .toPromise();

    if (!confirmed) return;
    try {
      await this.directory.deleteHospital(hospital.id);
      this.snack.open(`${hospital.name} removed.`, 'Dismiss');
    } catch {
      this.snack.open('Could not remove the hospital.', 'Dismiss');
    }
  }
}
