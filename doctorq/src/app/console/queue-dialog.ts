import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DirectoryService } from '../core/directory.service';
import { QueueSession } from '../core/models';
import { QueueService, todayKey } from '../core/queue.service';

export interface QueueDialogData {
  /** Present when editing an existing queue. */
  session?: QueueSession;
}

@Component({
  selector: 'app-queue-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './queue-dialog.html',
  styleUrl: './dialog.scss',
})
export class QueueDialog {
  private readonly fb = inject(FormBuilder);
  private readonly directory = inject(DirectoryService);
  private readonly queue = inject(QueueService);
  private readonly ref = inject(MatDialogRef<QueueDialog>);
  private readonly data = inject<QueueDialogData>(MAT_DIALOG_DATA, { optional: true });

  readonly editing = !!this.data?.session;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  // Only doctors this user may act on AND that have been approved — the rules refuse a queue for
  // a doctor still awaiting an admin, so offering one here would just fail on save.
  readonly doctors = toSignal(this.directory.myApprovedDoctors$, { initialValue: [] });
  readonly hospitals = toSignal(this.directory.hospitals$, { initialValue: [] });

  readonly form = this.fb.nonNullable.group({
    doctorId: [{ value: this.data?.session?.doctorId ?? '', disabled: this.editing }, Validators.required],
    hospitalId: [
      { value: this.data?.session?.hospitalId ?? '', disabled: this.editing },
      Validators.required,
    ],
    room: [this.data?.session?.room ?? ''],
    avgMinutesPerPatient: [
      this.data?.session?.avgMinutesPerPatient ?? 10,
      [Validators.required, Validators.min(1)],
    ],
    startsAt: [this.data?.session?.startsAt ?? '09:00'],
    endsAt: [this.data?.session?.endsAt ?? '17:00'],
    capped: [this.data?.session ? this.data.session.maxSlots !== null : true],
    maxSlots: [this.data?.session?.maxSlots ?? 30, [Validators.min(1)]],
    note: [this.data?.session?.note ?? ''],
  });

  private readonly doctorId = toSignal(this.form.controls.doctorId.valueChanges, {
    initialValue: this.form.controls.doctorId.value,
  });
  readonly selectedDoctorId = computed(() => this.doctorId());

  /** A queue can only be held where the doctor actually practises. */
  readonly eligibleHospitals = computed(() => {
    const doctor = this.doctors().find((d) => d.id === this.selectedDoctorId());
    if (!doctor) return this.editing ? this.hospitals() : [];
    return this.hospitals().filter((h) => doctor.hospitalIds?.includes(h.id));
  });

  constructor() {
    // Switching doctor invalidates any hospital already picked — clear it rather than
    // letting a queue be opened at a hospital the doctor doesn't practise at.
    this.form.controls.doctorId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.hospitalId.setValue(''));
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    const maxSlots = v.capped ? Number(v.maxSlots) : null;

    try {
      if (this.editing) {
        await this.queue.updateSession(this.data!.session!.id, {
          room: v.room,
          avgMinutesPerPatient: Number(v.avgMinutesPerPatient),
          startsAt: v.startsAt,
          endsAt: v.endsAt,
          maxSlots,
          note: v.note,
        });
      } else {
        await this.queue.openSession({
          doctorId: v.doctorId,
          hospitalId: v.hospitalId,
          date: todayKey(),
          room: v.room,
          avgMinutesPerPatient: Number(v.avgMinutesPerPatient),
          startsAt: v.startsAt,
          endsAt: v.endsAt,
          maxSlots,
          note: v.note,
        });
      }
      this.ref.close(true);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not save the queue.');
    } finally {
      this.busy.set(false);
    }
  }
}
