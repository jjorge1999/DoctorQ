import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { Observable, combineLatest, map, shareReplay } from 'rxjs';
import { AuthService } from './auth.service';
import { FIRESTORE, collection$ } from './firebase';
import { Doctor, Hospital } from './models';
import { SettingsService } from './settings.service';

/** A record is approved unless it says otherwise — anything predating the approval gates stands. */
export const isApproved = (record: { approved?: boolean }): boolean => record.approved !== false;

/** Hospitals and doctor profiles: the reference data the queue board joins against. */
@Injectable({ providedIn: 'root' })
export class DirectoryService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);

  /** Everything on file, approved or not. The console needs the pending ones; the board does not. */
  readonly allHospitals$: Observable<Hospital[]> = collection$<Hospital>(
    query(collection(this.db, 'hospitals'), orderBy('name')),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly allDoctors$: Observable<Doctor[]> = collection$<Doctor>(
    query(collection(this.db, 'doctors'), orderBy('fullName')),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  /**
   * The approved directory. This is what patients see and what a queue may be opened against —
   * a doctor awaiting approval must not reach the public board.
   */
  readonly hospitals$: Observable<Hospital[]> = this.allHospitals$.pipe(
    map((hospitals) => hospitals.filter(isApproved)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly doctors$: Observable<Doctor[]> = this.allDoctors$.pipe(
    map((doctors) => doctors.filter(isApproved)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Waiting on an admin. Empty for everyone but admins, whose rules let them see the queue. */
  readonly pendingDoctors$ = this.allDoctors$.pipe(
    map((doctors) => doctors.filter((d) => d.approved === false)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly pendingHospitals$ = this.allHospitals$.pipe(
    map((hospitals) => hospitals.filter((h) => h.approved === false)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * The doctors the signed-in user may act on. An admin gets the whole roster; a staff member
   * gets the doctors they created themselves plus any an admin has handed them. This mirrors
   * `canManageDoctor()` in firestore.rules — keep the two in step.
   *
   * Drawn from the unfiltered list on purpose: a staff member must be able to see their own
   * doctor sitting in the approval queue, rather than have it vanish until an admin gets to it.
   */
  readonly myDoctors$: Observable<Doctor[]> = combineLatest([
    this.allDoctors$,
    toObservable(this.auth.user),
  ]).pipe(
    map(([doctors, user]) => {
      if (!user) return [];
      if (user.role === 'admin') return doctors;
      return doctors.filter((d) => d.ownerUid === user.uid || user.doctorIds.includes(d.id));
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Of those, the ones a queue can actually be opened for today. */
  readonly myApprovedDoctors$: Observable<Doctor[]> = this.myDoctors$.pipe(
    map((doctors) => doctors.filter(isApproved)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Mine, but still sitting in an admin's approval queue. */
  readonly myPendingDoctors$: Observable<Doctor[]> = this.myDoctors$.pipe(
    map((doctors) => doctors.filter((d) => d.approved === false)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Doctors this user created. They have full say over these, including hospitals and deletion. */
  readonly myOwnedDoctorIds$: Observable<Set<string>> = this.myDoctors$.pipe(
    map((doctors) => {
      const uid = this.auth.user()?.uid;
      return new Set(doctors.filter((d) => d.ownerUid === uid).map((d) => d.id));
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * An admin's hospital is live at once. A staff member's is allowed only if
   * `allowStaffHospitals` is on, and then lands approved or pending per `autoApproveHospitals`.
   * The rules re-check both — this just keeps the client from writing something that will bounce.
   */
  async addHospital(data: Omit<Hospital, 'id' | 'approved' | 'ownerUid'>): Promise<void> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in to add a hospital.');

    const settings = this.settings.settings();
    const isAdmin = user.role === 'admin';
    if (!isAdmin && !settings.allowStaffHospitals) {
      throw new Error('Only an administrator can add hospitals.');
    }

    await addDoc(collection(this.db, 'hospitals'), {
      ...data,
      approved: isAdmin || settings.autoApproveHospitals,
      ...(isAdmin ? {} : { ownerUid: user.uid }),
      createdAt: Date.now(),
    });
  }

  async updateHospital(id: string, data: Partial<Hospital>): Promise<void> {
    await updateDoc(doc(this.db, 'hospitals', id), { ...data });
  }

  async deleteHospital(id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'hospitals', id));
  }

  /**
   * Stamps the creator as owner. The rules require `ownerUid` to be the caller's own uid, so a
   * doctor can never be created already belonging to somebody else. Whether it goes live
   * immediately or waits for an admin is the `autoApproveDoctors` setting.
   */
  async addDoctor(data: Omit<Doctor, 'id' | 'ownerUid' | 'approved'>): Promise<void> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in to add a doctor.');

    await addDoc(collection(this.db, 'doctors'), {
      ...data,
      ownerUid: user.uid,
      approved: user.role === 'admin' || this.settings.settings().autoApproveDoctors,
      createdAt: Date.now(),
    });
  }

  /** Admin only — the rules reject `approved` changes from anyone else. */
  async setDoctorApproved(id: string, approved: boolean): Promise<void> {
    await updateDoc(doc(this.db, 'doctors', id), { approved });
  }

  async setHospitalApproved(id: string, approved: boolean): Promise<void> {
    await updateDoc(doc(this.db, 'hospitals', id), { approved });
  }

  async updateDoctor(id: string, data: Partial<Doctor>): Promise<void> {
    await updateDoc(doc(this.db, 'doctors', id), { ...data });
  }

  async deleteDoctor(id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'doctors', id));
  }
}
