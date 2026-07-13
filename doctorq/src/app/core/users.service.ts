import { Injectable, inject } from '@angular/core';
import { collection, deleteDoc, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import { Observable, map, shareReplay } from 'rxjs';
import { FIRESTORE, collection$ } from './firebase';
import { AppUser, Role } from './models';

/** Staff accounts. Readable only by admins — the rules reject the query for anyone else. */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly db = inject(FIRESTORE);

  readonly users$: Observable<AppUser[]> = collection$<{ id: string } & Partial<AppUser>>(
    query(collection(this.db, 'users'), orderBy('displayName')),
  ).pipe(
    map((docs) =>
      docs.map<AppUser>((d) => ({
        uid: d.id,
        email: d.email ?? '',
        displayName: d.displayName ?? '',
        role: d.role === 'admin' ? 'admin' : 'staff',
        doctorIds: Array.isArray(d.doctorIds) ? d.doctorIds : [],
        approved: d.approved !== false,
        createdAt: d.createdAt,
      })),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  async setRole(uid: string, role: Role): Promise<void> {
    // An admin's reach is every doctor, so a per-doctor assignment would be meaningless noise.
    await updateDoc(doc(this.db, 'users', uid), {
      role,
      ...(role === 'admin' ? { doctorIds: [] } : {}),
    });
  }

  async setAssignedDoctors(uid: string, doctorIds: string[]): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid), { doctorIds });
  }

  /** Lets a pending sign-up into the console, or puts an existing member back on hold. */
  async setApproved(uid: string, approved: boolean): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid), { approved });
  }

  readonly pendingUsers$ = this.users$.pipe(
    map((users) => users.filter((u) => u.approved === false)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  async remove(uid: string): Promise<void> {
    // Removes console access. The Firebase Auth account itself lives on until it is deleted
    // from the Firebase console or the Admin SDK.
    await deleteDoc(doc(this.db, 'users', uid));
  }
}
