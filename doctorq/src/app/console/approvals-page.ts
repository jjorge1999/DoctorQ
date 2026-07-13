import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { DirectoryService } from '../core/directory.service';
import { AppUser, Doctor, Hospital } from '../core/models';
import { SettingsService } from '../core/settings.service';
import { UsersService } from '../core/users.service';
import { confirmDialog } from '../shared/dialog';
import { ConfirmDialog } from './confirm-dialog';

@Component({
  selector: 'app-approvals-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './approvals-page.html',
  styleUrl: './approvals-page.scss',
})
export class ApprovalsPage {
  private readonly directory = inject(DirectoryService);
  private readonly users = inject(UsersService);
  private readonly settingsService = inject(SettingsService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly settings = this.settingsService.settings;
  readonly pendingUsers = toSignal(this.users.pendingUsers$, { initialValue: [] as AppUser[] });
  readonly pendingDoctors = toSignal(this.directory.pendingDoctors$, {
    initialValue: [] as Doctor[],
  });
  readonly pendingHospitals = toSignal(this.directory.pendingHospitals$, {
    initialValue: [] as Hospital[],
  });
  private readonly allUsers = toSignal(this.users.users$, { initialValue: [] as AppUser[] });

  readonly busy = signal<string | null>(null);

  readonly total = computed(
    () =>
      this.pendingUsers().length + this.pendingDoctors().length + this.pendingHospitals().length,
  );

  /** Every gate is open, so nothing can ever land here. Worth saying, rather than showing an empty page. */
  readonly allAutomatic = computed(() => {
    const s = this.settings();
    return s.autoApproveStaff && s.autoApproveDoctors && (!s.allowStaffHospitals || s.autoApproveHospitals);
  });

  submitterName(uid?: string): string {
    if (!uid) return 'an administrator';
    return this.allUsers().find((u) => u.uid === uid)?.displayName ?? 'a staff member';
  }

  async approveUser(user: AppUser): Promise<void> {
    await this.run(user.uid, () => this.users.setApproved(user.uid, true), `${user.displayName} can now use the console.`);
  }

  async rejectUser(user: AppUser): Promise<void> {
    const ok = await this.confirm(
      `Reject ${user.displayName}?`,
      'Their console access is removed. The Firebase Auth login still exists — delete it in the Firebase console to remove it entirely.',
      'Reject',
    );
    if (!ok) return;
    await this.run(user.uid, () => this.users.remove(user.uid), `${user.displayName} was rejected.`);
  }

  async approveDoctor(doctor: Doctor): Promise<void> {
    await this.run(
      doctor.id,
      () => this.directory.setDoctorApproved(doctor.id, true),
      `${doctor.fullName} is now on the public board.`,
    );
  }

  async rejectDoctor(doctor: Doctor): Promise<void> {
    const ok = await this.confirm(
      `Reject ${doctor.fullName}?`,
      'The profile is deleted. Whoever added it will have to start again.',
      'Reject',
    );
    if (!ok) return;
    await this.run(doctor.id, () => this.directory.deleteDoctor(doctor.id), `${doctor.fullName} was rejected.`);
  }

  async approveHospital(hospital: Hospital): Promise<void> {
    await this.run(
      hospital.id,
      () => this.directory.setHospitalApproved(hospital.id, true),
      `${hospital.name} is now available.`,
    );
  }

  async rejectHospital(hospital: Hospital): Promise<void> {
    const ok = await this.confirm(
      `Reject ${hospital.name}?`,
      'The hospital is deleted. Anyone who was waiting to hold a clinic there will need another one.',
      'Reject',
    );
    if (!ok) return;
    await this.run(hospital.id, () => this.directory.deleteHospital(hospital.id), `${hospital.name} was rejected.`);
  }

  private confirm(title: string, body: string, confirm: string): Promise<boolean | undefined> {
    return this.dialog
      .open(ConfirmDialog, confirmDialog({ title, body, confirm, destructive: true }))
      .afterClosed()
      .toPromise();
  }

  private async run(id: string, action: () => Promise<void>, success: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(id);
    try {
      await action();
      this.snack.open(success, 'Dismiss');
    } catch {
      this.snack.open('That did not go through. Try again.', 'Dismiss');
    } finally {
      this.busy.set(null);
    }
  }
}
