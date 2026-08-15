import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { RouterLink } from '@angular/router';

export interface MoreNavItem {
  path: string;
  icon: string;
  label: string;
  badge: number;
}

@Component({
  selector: 'app-more-nav-sheet',
  imports: [MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet">
      @for (item of items; track item.path) {
        <a [routerLink]="'/console/' + item.path" (click)="ref.dismiss()">
          <mat-icon>{{ item.icon }}</mat-icon>
          <span>{{ item.label }}</span>
          @if (item.badge) {
            <span class="badge">{{ item.badge }}</span>
          }
        </a>
      }
    </div>
  `,
  styles: `
    .sheet {
      display: flex;
      flex-direction: column;
      padding: 8px 8px calc(12px + env(safe-area-inset-bottom));
    }

    a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 12px;
      border-radius: 12px;
      color: inherit;
      text-decoration: none;
      font-size: 0.94rem;
    }

    a:active {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    .badge {
      margin-left: auto;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: var(--status-paused-bg);
      color: var(--status-paused);
      font-size: 0.7rem;
      font-weight: 700;
    }
  `,
})
export class MoreNavSheet {
  readonly ref = inject(MatBottomSheetRef<MoreNavSheet>);
  readonly items = inject<MoreNavItem[]>(MAT_BOTTOM_SHEET_DATA);
}
