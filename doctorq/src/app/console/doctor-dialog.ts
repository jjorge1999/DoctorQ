import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';
import { Doctor } from '../core/models';

export const SPECIALTIES = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'ENT',
  'Family Medicine',
  'Gastroenterology',
  'General Surgery',
  'Internal Medicine',
  'Nephrology',
  'Neurology',
  'Obstetrics & Gynaecology',
  'Oncology',
  'Ophthalmology',
  'Orthopaedics',
  'Paediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Rheumatology',
  'Urology',
];

@Component({
  selector: 'app-doctor-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './doctor-dialog.html',
  styleUrl: './dialog.scss',
})
export class DoctorDialog {
  private readonly fb = inject(FormBuilder);
  private readonly directory = inject(DirectoryService);
  private readonly auth = inject(AuthService);
  private readonly ref = inject(MatDialogRef<DoctorDialog>);

  readonly doctor = inject<Doctor | null>(MAT_DIALOG_DATA, { optional: true });
  readonly specialties = SPECIALTIES;
  readonly hospitals = toSignal(this.directory.hospitals$, { initialValue: [] });
  readonly isAdmin = this.auth.isAdmin;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * You may set the hospitals on a doctor you own (a new one is yours by definition) and on any
   * doctor if you are an admin. A doctor merely assigned to you by an admin is theirs, not yours,
   * and the rules reject the change — so the control is disabled rather than left to fail on save.
   */
  readonly canSetHospitals =
    this.auth.isAdmin() || !this.doctor || this.doctor.ownerUid === this.auth.user()?.uid;

  readonly form = this.fb.nonNullable.group({
    fullName: [this.doctor?.fullName ?? '', Validators.required],
    specialty: [this.doctor?.specialty ?? '', Validators.required],
    licenseNo: [this.doctor?.licenseNo ?? ''],
    hospitalIds: [
      { value: this.doctor?.hospitalIds ?? ([] as string[]), disabled: !this.canSetHospitals },
    ],
    photoUrl: [this.doctor?.photoUrl ?? ''],
    bio: [this.doctor?.bio ?? ''],
  });

  initials(name: string): string {
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

  async save(): Promise<void> {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const value = this.form.getRawValue();
      if (this.doctor) {
        await this.directory.updateDoctor(this.doctor.id, value);
      } else {
        await this.directory.addDoctor(value);
      }
      this.ref.close(true);
    } catch {
      this.error.set('Could not save the doctor. Check your connection and try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
