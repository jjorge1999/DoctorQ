import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Hospital } from '../core/models';

export interface HospitalFilterSheetData {
  hospitals: Hospital[];
  selected: string;
}

@Component({
  selector: 'app-hospital-filter-sheet',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet">
      <h2>Filter by hospital</h2>
      <button class="option" [class.selected]="data.selected === 'all'" (click)="choose('all')">
        <span>All hospitals</span>
        @if (data.selected === 'all') {
          <mat-icon>check</mat-icon>
        }
      </button>
      @for (hospital of data.hospitals; track hospital.id) {
        <button
          class="option"
          [class.selected]="data.selected === hospital.id"
          (click)="choose(hospital.id)"
        >
          <span>{{ hospital.name }}</span>
          @if (data.selected === hospital.id) {
            <mat-icon>check</mat-icon>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .sheet {
      display: flex;
      flex-direction: column;
      padding: 8px 8px calc(12px + env(safe-area-inset-bottom));
    }

    h2 {
      margin: 8px 12px 12px;
      font-size: 0.8rem;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--mat-sys-on-surface-variant);
    }

    .option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 12px;
      border: none;
      border-radius: 12px;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 0.94rem;
      text-align: left;
      cursor: pointer;
    }

    .option:active {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    .option.selected {
      color: var(--mat-sys-primary);
      font-weight: 650;
    }

    .option mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }
  `,
})
export class HospitalFilterSheet {
  private readonly ref = inject(MatBottomSheetRef<HospitalFilterSheet, string>);
  readonly data = inject<HospitalFilterSheetData>(MAT_BOTTOM_SHEET_DATA);

  choose(hospitalId: string): void {
    this.ref.dismiss(hospitalId);
  }
}
