import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { doc, setDoc } from 'firebase/firestore';
import { Observable, map, shareReplay } from 'rxjs';
import { FIRESTORE, doc$ } from './firebase';
import { AccessSettings, DEFAULT_ACCESS_SETTINGS } from './models';

/** The one document that decides how much staff can do unsupervised. Admin-writable, world-readable. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly db = inject(FIRESTORE);

  /**
   * Missing document, or a missing flag, falls back to the permissive default — so switching a
   * gate on is an explicit act, and a project that never visits the settings page keeps working.
   */
  readonly settings$: Observable<AccessSettings> = doc$<Partial<AccessSettings>>(
    doc(this.db, 'settings', 'access'),
  ).pipe(
    map((stored) => ({ ...DEFAULT_ACCESS_SETTINGS, ...(stored ?? {}) })),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly settings = toSignal(this.settings$, { initialValue: DEFAULT_ACCESS_SETTINGS });

  async update(patch: Partial<AccessSettings>): Promise<void> {
    await setDoc(doc(this.db, 'settings', 'access'), { ...patch, updatedAt: Date.now() }, { merge: true });
  }
}
