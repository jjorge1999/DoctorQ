import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  body: string;
  confirm: string;
  destructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg">
      <header class="dlg-head">
        <span class="dlg-icon" [class.warn]="data.destructive">
          <mat-icon>{{ data.destructive ? 'warning' : 'help' }}</mat-icon>
        </span>
        <div>
          <h2>{{ data.title }}</h2>
        </div>
      </header>

      <div class="dlg-body" mat-dialog-content>
        <p>{{ data.body }}</p>
      </div>

      <footer class="dlg-foot" mat-dialog-actions>
        <span class="spacer"></span>
        <button mat-stroked-button [mat-dialog-close]="false">Cancel</button>
        <button mat-flat-button [class.destructive]="data.destructive" [mat-dialog-close]="true">
          {{ data.confirm }}
        </button>
      </footer>
    </div>
  `,
  styles: `
    .spacer {
      flex: 1;
    }

    p {
      margin: 0;
      line-height: 1.6;
      color: var(--mat-sys-on-surface-variant);
    }

    .dlg-icon.warn {
      background: var(--status-cutoff-bg);
      color: var(--status-cutoff);
    }

    .destructive {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }

    @media (max-width: 719px) {
      .spacer {
        display: none;
      }
    }
  `,
})
export class ConfirmDialog {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
