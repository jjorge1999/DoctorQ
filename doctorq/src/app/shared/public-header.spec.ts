import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PublicHeader } from './public-header';

function fakeAuth(isSignedIn: boolean) {
  return { isSignedIn: signal(isSignedIn) } as unknown as AuthService;
}

describe('PublicHeader', () => {
  async function render(auth: AuthService) {
    await TestBed.configureTestingModule({
      imports: [PublicHeader],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(PublicHeader);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a Help link and "Staff sign in" when signed out', async () => {
    const fixture = await render(fakeAuth(false));
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Help');
    expect(text).toContain('Staff sign in');
    expect(fixture.nativeElement.querySelector('a[href="/help"]')).not.toBeNull();
  });

  it('shows "Console" instead of "Staff sign in" when signed in', async () => {
    const fixture = await render(fakeAuth(true));
    expect(fixture.nativeElement.textContent).toContain('Console');
    expect(fixture.nativeElement.textContent).not.toContain('Staff sign in');
  });
});
