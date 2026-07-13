import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';
import { AppUser, Role } from '../core/models';
import { UsersService } from '../core/users.service';
import { confirmDialog, formDialog } from '../shared/dialog';
import { AssignDoctorsDialog } from './assign-doctors-dialog';
import { ConfirmDialog } from './confirm-dialog';

@Component({
  selector: 'app-staff-page',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-page.html',
  styleUrl: './directory-page.scss',
})
export class StaffPage {
  private readonly users = inject(UsersService);
  private readonly directory = inject(DirectoryService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly staff = toSignal(this.users.users$, { initialValue: [] as AppUser[] });
  private readonly doctors = toSignal(this.directory.doctors$, { initialValue: [] });

  readonly columns = ['person', 'role', 'doctors', 'actions'];

  isSelf(user: AppUser): boolean {
    return this.auth.user()?.uid === user.uid;
  }

  /** Everything this person can act on: the doctors they created, plus any handed to them. */
  doctorNames(user: AppUser): string {
    if (user.role === 'admin') return 'All doctors';

    const owned = this.doctors().filter((d) => d.ownerUid === user.uid);
    const assigned = this.doctors().filter(
      (d) => user.doctorIds.includes(d.id) && d.ownerUid !== user.uid,
    );

    const parts = [
      ...owned.map((d) => d.fullName),
      ...assigned.map((d) => `${d.fullName} (assigned)`),
    ];
    return parts.length ? parts.join(', ') : 'None yet';
  }

  initials(name = ''): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  assign(user: AppUser): void {
    this.dialog.open(AssignDoctorsDialog, formDialog(user));
  }

  async setRole(user: AppUser, role: Role): Promise<void> {
    if (role === user.role) return;

    // The last admin must not be able to demote themselves — that would leave the project with
    // nobody able to manage hospitals, doctors or staff.
    if (user.role === 'admin' && role === 'staff') {
      const admins = this.staff().filter((u) => u.role === 'admin').length;
      if (admins <= 1) {
        this.snack.open('This is the only administrator. Promote someone else first.', 'Dismiss');
        return;
      }
    }

    const confirmed = await this.confirm({
      title: role === 'admin' ? `Make ${user.displayName} an administrator?` : `Demote ${user.displayName} to staff?`,
      body:
        role === 'admin'
          ? 'Administrators can manage every doctor, hospital and staff account, and see every queue.'
          : 'They will keep console access but only see the doctors you assign to them. Any existing assignment is preserved.',
      confirm: role === 'admin' ? 'Make administrator' : 'Demote to staff',
    });
    if (!confirmed) return;

    try {
      await this.users.setRole(user.uid, role);
      this.snack.open(`${user.displayName} is now ${role === 'admin' ? 'an administrator' : 'staff'}.`, 'Dismiss');
    } catch {
      this.snack.open('Could not change the role.', 'Dismiss');
    }
  }

  async revoke(user: AppUser): Promise<void> {
    const confirmed = await this.confirm({
      title: `Revoke console access for ${user.displayName}?`,
      body: 'They will be signed out of the console and cannot sign back in. Their Firebase Auth login itself still exists — delete it in the Firebase console to remove it entirely.',
      confirm: 'Revoke access',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await this.users.remove(user.uid);
      this.snack.open(`Access revoked for ${user.displayName}.`, 'Dismiss');
    } catch {
      this.snack.open('Could not revoke access.', 'Dismiss');
    }
  }

  private confirm(data: {
    title: string;
    body: string;
    confirm: string;
    destructive?: boolean;
  }): Promise<boolean | undefined> {
    return this.dialog.open(ConfirmDialog, confirmDialog(data)).afterClosed().toPromise();
  }
}
