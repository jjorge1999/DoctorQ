import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';
import { SettingsService } from '../core/settings.service';
import { UsersService } from '../core/users.service';
import { MoreNavSheet } from './more-nav-sheet';

@Component({
  selector: 'app-console-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './console-shell.html',
  styleUrl: './console-shell.scss',
})
export class ConsoleShell {
  private readonly auth = inject(AuthService);
  private readonly directory = inject(DirectoryService);
  private readonly users = inject(UsersService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly isAdmin = this.auth.isAdmin;
  /** A staff account the admin has not let through yet: signed in, but held at the door. */
  readonly isApproved = this.auth.isApproved;
  /** Shown to staff so their scope is stated, not inferred from an empty queue list. */
  readonly myDoctors = toSignal(this.directory.myDoctors$, { initialValue: [] });

  /** Admins only — the rules deny the underlying reads to everyone else, so it stays 0 for staff. */
  private readonly pendingUsers = toSignal(this.users.pendingUsers$, { initialValue: [] });
  private readonly pendingDoctors = toSignal(this.directory.pendingDoctors$, { initialValue: [] });
  private readonly pendingHospitals = toSignal(this.directory.pendingHospitals$, {
    initialValue: [],
  });

  readonly pendingCount = computed(
    () =>
      this.pendingUsers().length + this.pendingDoctors().length + this.pendingHospitals().length,
  );

  private readonly settingsService = inject(SettingsService);
  private readonly settings = this.settingsService.settings;

  private readonly allNav = [
    { path: 'queues', icon: 'confirmation_number', label: 'Queue control', adminOnly: false },
    { path: 'doctors', icon: 'stethoscope', label: 'Doctors', adminOnly: false },
    { path: 'hospitals', icon: 'local_hospital', label: 'Hospitals', adminOnly: false },
    { path: 'approvals', icon: 'inbox', label: 'Approvals', adminOnly: true },
    { path: 'staff', icon: 'shield_person', label: 'Staff', adminOnly: true },
    { path: 'settings', icon: 'tune', label: 'Settings', adminOnly: true },
  ];

  // Hiding these is a courtesy, not the control: adminGuard turns staff away from the routes,
  // and firestore.rules rejects the writes even if they get there. Hospitals is the one item
  // whose visibility to staff is a policy choice rather than a fixed rule.
  readonly nav = computed(() =>
    this.allNav.filter((item) => {
      if (item.adminOnly) return this.isAdmin();
      if (item.path === 'hospitals') {
        return this.isAdmin() || this.settings().allowStaffHospitals;
      }
      return true;
    }),
  );

  /** The badge only makes sense on the one item it refers to. */
  badgeFor(path: string): number {
    return path === 'approvals' ? this.pendingCount() : 0;
  }

  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly primaryPaths = ['queues', 'doctors', 'hospitals'];

  readonly primaryNav = computed(() =>
    this.nav().filter((item) => this.primaryPaths.includes(item.path)),
  );
  readonly moreNav = computed(() =>
    this.nav().filter((item) => !this.primaryPaths.includes(item.path)),
  );
  readonly moreBadgeCount = computed(() =>
    this.moreNav().reduce((sum, item) => sum + this.badgeFor(item.path), 0),
  );
  readonly tabCount = computed(() => this.primaryNav().length + (this.moreNav().length ? 1 : 0));

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly activeTabIndex = computed(() => {
    const url = this.currentUrl();
    const primary = this.primaryNav();
    const idx = primary.findIndex((item) => url.includes(`/console/${item.path}`));
    if (idx !== -1) return idx;
    return this.moreNav().some((item) => url.includes(`/console/${item.path}`)) ? primary.length : 0;
  });

  openMoreNav(): void {
    this.bottomSheet.open(MoreNavSheet, {
      data: this.moreNav().map((item) => ({ ...item, badge: this.badgeFor(item.path) })),
    });
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

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
