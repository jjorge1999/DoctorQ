import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <a class="brand" routerLink="/">
        <span class="mark"><mat-icon>graphic_eq</mat-icon></span>
        <span class="name">Doctor<b>Q</b></span>
      </a>
      <a mat-stroked-button routerLink="/console">
        <mat-icon>lock</mat-icon>
        Staff sign in
      </a>
    </header>
  `,
  styles: `
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 24px;
      background: color-mix(in srgb, var(--mat-sys-surface) 82%, transparent);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--app-border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: inherit;
    }

    .mark {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    .mark mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }

    .name {
      font-size: 1.15rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .name b {
      color: var(--mat-sys-primary);
    }
  `,
})
export class PublicHeader {}
