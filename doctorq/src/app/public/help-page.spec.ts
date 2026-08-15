import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { HelpPage } from './help-page';

function fakeAuth(
  overrides: Partial<{ isSignedIn: boolean; isApproved: boolean; isAdmin: boolean }>,
) {
  return {
    isSignedIn: signal(overrides.isSignedIn ?? false),
    isApproved: signal(overrides.isApproved ?? false),
    isAdmin: signal(overrides.isAdmin ?? false),
  } as unknown as AuthService;
}

describe('HelpPage', () => {
  async function render(auth: AuthService) {
    await TestBed.configureTestingModule({
      imports: [HelpPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(HelpPage);
    fixture.detectChanges();
    return fixture;
  }

  it('always renders the patient FAQ section, signed out', async () => {
    const fixture = await render(fakeAuth({}));
    const panels = fixture.nativeElement.querySelectorAll('#patients mat-expansion-panel');
    expect(panels.length).toBe(6);
  });

  it('shows the sign-in callout and no staff section when signed out', async () => {
    const fixture = await render(fakeAuth({}));
    expect(fixture.nativeElement.querySelector('#staff')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Staff sign in');
    expect(fixture.nativeElement.querySelector('.jump-nav')).toBeNull();
  });

  it('shows a pending-approval notice, not the staff section, when unapproved', async () => {
    const fixture = await render(fakeAuth({ isSignedIn: true, isApproved: false }));
    expect(fixture.nativeElement.querySelector('#staff')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Waiting for approval');
  });

  it('shows the staff FAQ section, without admin entries, for approved staff', async () => {
    const fixture = await render(fakeAuth({ isSignedIn: true, isApproved: true, isAdmin: false }));
    const panels = fixture.nativeElement.querySelectorAll('#staff mat-expansion-panel');
    expect(panels.length).toBe(6);
    expect(fixture.nativeElement.querySelector('.jump-nav')).not.toBeNull();
  });

  it('adds admin entries to the staff section for admins', async () => {
    const fixture = await render(fakeAuth({ isSignedIn: true, isApproved: true, isAdmin: true }));
    const panels = fixture.nativeElement.querySelectorAll('#staff mat-expansion-panel');
    expect(panels.length).toBe(9);
  });
});
