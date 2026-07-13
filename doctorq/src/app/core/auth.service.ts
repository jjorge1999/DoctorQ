import { Injectable, computed, inject, signal } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { Unsubscribe, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { FIREBASE_AUTH, FIRESTORE } from './firebase';
import { AppUser } from './models';
import { SettingsService } from './settings.service';

/** Thrown when the Auth account is valid but carries no staff profile. */
export class NoConsoleAccessError extends Error {
  constructor() {
    super('This account has no console access yet. Ask an administrator to enable it.');
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly db = inject(FIRESTORE);
  private readonly settings = inject(SettingsService);

  /** undefined until Firebase has restored (or rejected) the persisted session. */
  private readonly _user = signal<AppUser | null | undefined>(undefined);
  readonly user = this._user.asReadonly();
  readonly ready = computed(() => this._user() !== undefined);
  readonly isSignedIn = computed(() => !!this._user());

  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  /**
   * An unapproved staff member can sign in and see that they are waiting, and nothing else.
   * Admins are approved by definition — an admin left in limbo could never approve themselves.
   */
  readonly isApproved = computed(() => {
    const user = this._user();
    return !!user && (user.role === 'admin' || user.approved !== false);
  });

  // Which doctors a staff member may act on depends on ownership as well as assignment, so it
  // is derived in DirectoryService.myDoctors$ where the doctor documents are actually in hand.

  private profileUnsubscribe?: Unsubscribe;

  constructor() {
    onAuthStateChanged(this.auth, async (fbUser) => {
      this.profileUnsubscribe?.();
      if (!fbUser) {
        this._user.set(null);
        return;
      }
      this.watchProfile(fbUser.uid, fbUser.email ?? '', fbUser.displayName ?? '');
    });
  }

  /**
   * Staff profiles live in `users/{uid}`. The Auth record only proves identity — this document
   * is what grants console access and says which doctors the holder may act on.
   *
   * Watched rather than read once, so that an admin changing someone's role or doctor
   * assignment takes effect in their open session instead of at their next sign-in.
   */
  private watchProfile(uid: string, email: string, displayName: string): void {
    this.profileUnsubscribe = onSnapshot(
      doc(this.db, 'users', uid),
      (snap) => this._user.set(snap.exists() ? this.toAppUser(uid, email, displayName, snap.data()) : null),
      () => this._user.set(null),
    );
  }

  private toAppUser(
    uid: string,
    email: string,
    displayName: string,
    data: Record<string, unknown>,
  ): AppUser {
    const stored = data as Partial<AppUser>;
    return {
      uid,
      email: stored.email ?? email,
      displayName: stored.displayName ?? displayName,
      // Anything not explicitly marked admin is treated as the least-privileged role.
      role: stored.role === 'admin' ? 'admin' : 'staff',
      doctorIds: Array.isArray(stored.doctorIds) ? stored.doctorIds : [],
      // Absent means approved: accounts created before approval existed keep working.
      approved: stored.approved !== false,
    };
  }

  /**
   * Resolves only once the profile is in the signal. `onAuthStateChanged` fires on its own
   * schedule, and if we returned before it did, the route guard would still read the
   * signed-out value and bounce the user straight back to /login.
   */
  async signIn(email: string, password: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    const snap = await getDoc(doc(this.db, 'users', cred.user.uid));
    if (!snap.exists()) {
      await signOut(this.auth);
      throw new NoConsoleAccessError();
    }
    this._user.set(
      this.toAppUser(cred.user.uid, cred.user.email ?? email, cred.user.displayName ?? '', snap.data()),
    );
    this.watchProfile(cred.user.uid, cred.user.email ?? email, cred.user.displayName ?? '');
  }

  /**
   * Self-registration always lands on the least-privileged role with no doctors assigned.
   * Promoting to admin, or attaching a doctor, is an admin-only action — enforced in
   * firestore.rules, not here.
   *
   * Whether the account is usable immediately or has to wait for an admin is the
   * `autoApproveStaff` setting. The rules pin `approved` to whatever that setting says, so a
   * hand-crafted signup request cannot wave itself through.
   */
  async register(name: string, email: string, password: string): Promise<void> {
    const autoApprove = (await firstValueFrom(this.settings.settings$)).autoApproveStaff;

    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(this.db, 'users', cred.user.uid), {
      email,
      displayName: name,
      role: 'staff' as const,
      doctorIds: [] as string[],
      approved: autoApprove,
      createdAt: Date.now(),
    });
    this._user.set({
      uid: cred.user.uid,
      email,
      displayName: name,
      role: 'staff',
      doctorIds: [],
      approved: autoApprove,
    });
    this.watchProfile(cred.user.uid, email, name);
  }

  async signOut(): Promise<void> {
    this.profileUnsubscribe?.();
    await signOut(this.auth);
  }
}
