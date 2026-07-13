import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { DirectoryService } from '../core/directory.service';
import { AppUser } from '../core/models';
import { UsersService } from '../core/users.service';

@Component({
  selector: 'app-assign-doctors-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <header class="dlg-head">
        <span class="dlg-icon"><mat-icon>stethoscope</mat-icon></span>
        <div>
          <h2>Assign doctors</h2>
          <p>
            <b>{{ user.displayName || user.email }}</b> will see the queues of the doctors picked
            here — and no others besides their own.
          </p>
        </div>
      </header>

      <div class="dlg-body" mat-dialog-content>
        <form [formGroup]="form">
          <div class="dlg-grid">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Doctors</mat-label>
              <mat-icon matPrefix>stethoscope</mat-icon>
              <mat-select formControlName="doctorIds" multiple panelWidth="">
                @for (doctor of doctors(); track doctor.id) {
                  <mat-option [value]="doctor.id">
                    {{ doctor.fullName }} — {{ doctor.specialty }}
                  </mat-option>
                }
              </mat-select>
              <mat-hint>Leave empty to hand over none.</mat-hint>
            </mat-form-field>
          </div>
        </form>

        @if (error()) {
          <div class="dlg-error">
            <mat-icon>error</mat-icon>
            <span>{{ error() }}</span>
          </div>
        }
      </div>

      <footer class="dlg-foot" mat-dialog-actions>
        <span class="spacer"></span>
        <button mat-stroked-button mat-dialog-close>Cancel</button>
        <button mat-flat-button [disabled]="busy()" (click)="save()">
          <mat-icon>save</mat-icon>
          Save assignment
        </button>
      </footer>
    </div>
  `,
  styleUrl: './dialog.scss',
})
export class AssignDoctorsDialog {
  private readonly fb = inject(FormBuilder);
  private readonly directory = inject(DirectoryService);
  private readonly users = inject(UsersService);
  private readonly ref = inject(MatDialogRef<AssignDoctorsDialog>);

  readonly user = inject<AppUser>(MAT_DIALOG_DATA);
  readonly doctors = toSignal(this.directory.doctors$, { initialValue: [] });
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    doctorIds: [this.user.doctorIds ?? ([] as string[])],
  });

  async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.users.setAssignedDoctors(this.user.uid, this.form.getRawValue().doctorIds);
      this.ref.close(true);
    } catch {
      this.error.set('Could not save the assignment. Only administrators may change it.');
    } finally {
      this.busy.set(false);
    }
  }
}
