import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';
import { DEFAULT_ACCESS_SETTINGS } from '../core/models';
import { SettingsService } from '../core/settings.service';
import { UsersService } from '../core/users.service';
import { ConsoleShell } from './console-shell';

describe('ConsoleShell', () => {
  it('links to /help from the sidenav footer', async () => {
    const fakeAuth = {
      user: signal({
        uid: 'u1',
        email: 'a@b.com',
        displayName: 'A',
        role: 'admin',
        doctorIds: [],
      }),
      isAdmin: signal(true),
      isApproved: signal(true),
    } as unknown as AuthService;
    const fakeDirectory = {
      myDoctors$: of([]),
      pendingDoctors$: of([]),
      pendingHospitals$: of([]),
    } as unknown as DirectoryService;
    const fakeUsers = { pendingUsers$: of([]) } as unknown as UsersService;
    const fakeSettings = {
      settings: signal(DEFAULT_ACCESS_SETTINGS),
    } as unknown as SettingsService;

    await TestBed.configureTestingModule({
      imports: [ConsoleShell],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuth },
        { provide: DirectoryService, useValue: fakeDirectory },
        { provide: UsersService, useValue: fakeUsers },
        { provide: SettingsService, useValue: fakeSettings },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConsoleShell);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[href="/help"]');
    expect(link).not.toBeNull();
    expect(link.textContent).toContain('Help');
  });
});

describe('ConsoleShell mobile navigation', () => {
  function setup({ isAdmin = false, url = '/console/queues', allowStaffHospitals = false } = {}) {
    const events$ = new Subject<unknown>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user: signal(null), isAdmin: signal(isAdmin), isApproved: signal(true) },
        },
        {
          provide: DirectoryService,
          useValue: { myDoctors$: of([]), pendingDoctors$: of([]), pendingHospitals$: of([]) },
        },
        { provide: UsersService, useValue: { pendingUsers$: of([]) } },
        {
          provide: SettingsService,
          useValue: { settings: signal({ ...DEFAULT_ACCESS_SETTINGS, allowStaffHospitals }) },
        },
      ],
    });
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', { value: url, configurable: true });
    Object.defineProperty(router, 'events', { value: events$.asObservable(), configurable: true });
    const fixture = TestBed.createComponent(ConsoleShell);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('puts queue/doctors/hospitals on the primary tab bar for staff without hospital access', () => {
    const shell = setup({ isAdmin: false, allowStaffHospitals: false });
    expect(shell.primaryNav().map((i) => i.path)).toEqual(['queues', 'doctors']);
    expect(shell.moreNav()).toEqual([]);
  });

  it('groups admin-only sections under "More" for an admin', () => {
    const shell = setup({ isAdmin: true });
    expect(shell.primaryNav().map((i) => i.path)).toEqual(['queues', 'doctors', 'hospitals']);
    expect(shell.moreNav().map((i) => i.path)).toEqual(['approvals', 'staff', 'settings']);
  });

  it('sizes the tab bar to include the More tab when there is a More section', () => {
    expect(setup({ isAdmin: true }).tabCount()).toBe(4);
  });

  it('sizes the tab bar with no More tab when there is no More section', () => {
    expect(setup({ isAdmin: false }).tabCount()).toBe(2);
  });

  it('resolves the active tab index from the current route', () => {
    expect(setup({ isAdmin: true, url: '/console/doctors' }).activeTabIndex()).toBe(1);
  });

  it('parks the active index on the More tab when a More-only route is current', () => {
    expect(setup({ isAdmin: true, url: '/console/settings' }).activeTabIndex()).toBe(3);
  });
});
