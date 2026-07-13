import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';
import { AppUser } from './models';

/** Resolves once Firebase has restored (or rejected) the persisted session. */
function settledUser() {
  const auth = inject(AuthService);
  return toObservable(auth.user).pipe(
    filter((user): user is AppUser | null => user !== undefined),
    take(1),
  );
}

/** Any signed-in user holding a staff profile. */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);

  return settledUser().pipe(
    map<AppUser | null, boolean | UrlTree>((user) =>
      user ? true : router.createUrlTree(['/login'], { queryParams: { next: state.url } }),
    ),
  );
};

/**
 * Admin-only areas (hospitals, staff accounts). Staff land back on queue control rather than
 * the login page — they are signed in, just not entitled to this page.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);

  return settledUser().pipe(
    map<AppUser | null, boolean | UrlTree>((user) => {
      if (!user) return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
      return user.role === 'admin' ? true : router.createUrlTree(['/console/queues']);
    }),
  );
};
