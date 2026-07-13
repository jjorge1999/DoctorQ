import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DirectoryService } from '../core/directory.service';
import { Hospital } from '../core/models';

@Component({
  selector: 'app-hospital-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hospital-dialog.html',
  styleUrl: './dialog.scss',
})
export class HospitalDialog {
  private readonly fb = inject(FormBuilder);
  private readonly directory = inject(DirectoryService);
  private readonly ref = inject(MatDialogRef<HospitalDialog>);

  readonly hospital = inject<Hospital | null>(MAT_DIALOG_DATA, { optional: true });
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [this.hospital?.name ?? '', Validators.required],
    address: [this.hospital?.address ?? '', Validators.required],
    city: [this.hospital?.city ?? '', Validators.required],
    phone: [this.hospital?.phone ?? ''],
  });

  async save(): Promise<void> {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const value = this.form.getRawValue();
      if (this.hospital) {
        await this.directory.updateHospital(this.hospital.id, value);
      } else {
        await this.directory.addHospital(value);
      }
      this.ref.close(true);
    } catch {
      this.error.set('Could not save the hospital. Check your connection and try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
