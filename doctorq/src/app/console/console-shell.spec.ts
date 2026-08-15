import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
