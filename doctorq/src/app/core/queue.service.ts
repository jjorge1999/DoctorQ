import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, map, shareReplay } from 'rxjs';
import { AuthService } from './auth.service';
import { DirectoryService } from './directory.service';
import { FIRESTORE, collection$, doc$ } from './firebase';
import { QueueBoardEntry, QueueSession, QueueStatus } from './models';

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A session with its waiting/called lists guaranteed present. */
type NormalisedSession = QueueSession & { waiting: number[]; called: number[] };

/**
 * Queues created before priority calling only had counters. Rebuild the lists from them:
 * everything up to `nowServing` was called in order, everything after it is still waiting.
 * Applied on read and inside every transaction, so an old queue upgrades itself on first use.
 */
export function normalise(session: QueueSession): NormalisedSession {
  if (session.waiting && session.called) {
    return session as NormalisedSession;
  }
  const range = (from: number, to: number) =>
    Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

  return {
    ...session,
    called: session.called ?? range(1, session.nowServing),
    waiting: session.waiting ?? range(session.nowServing + 1, session.lastIssued),
  };
}

@Injectable({ providedIn: 'root' })
export class QueueService {
  private readonly db = inject(FIRESTORE);
  private readonly directory = inject(DirectoryService);
  private readonly auth = inject(AuthService);

  /** Every queue running today, live. This is the single source for both the public board and the console. */
  readonly todaySessions$: Observable<QueueSession[]> = collection$<QueueSession>(
    query(collection(this.db, 'queues'), where('date', '==', todayKey())),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  /** Today's queues joined with doctor + hospital and enriched with the numbers patients care about. */
  readonly board$: Observable<QueueBoardEntry[]> = combineLatest([
    this.todaySessions$,
    this.directory.doctors$,
    this.directory.hospitals$,
  ]).pipe(
    map(([sessions, doctors, hospitals]) =>
      sessions
        .map((session) => this.toBoardEntry(session, doctors, hospitals))
        .sort((a, b) => (a.doctor?.fullName ?? '').localeCompare(b.doctor?.fullName ?? '')),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * The console's view of today: an admin sees every queue, a staff member only the queues of
   * the doctors they can manage. The public `board$` above stays unfiltered — patients must
   * see every clinic regardless of who happens to be signed in.
   */
  readonly myBoard$: Observable<QueueBoardEntry[]> = combineLatest([
    this.board$,
    this.directory.myDoctors$,
    toObservable(this.auth.isAdmin),
  ]).pipe(
    map(([entries, myDoctors, isAdmin]) => {
      if (isAdmin) return entries;
      const mine = new Set(myDoctors.map((d) => d.id));
      return entries.filter((e) => mine.has(e.session.doctorId));
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  entry$(sessionId: string): Observable<QueueBoardEntry | undefined> {
    return combineLatest([
      doc$<QueueSession>(doc(this.db, 'queues', sessionId)),
      this.directory.doctors$,
      this.directory.hospitals$,
    ]).pipe(
      map(([session, doctors, hospitals]) =>
        session ? this.toBoardEntry(session, doctors, hospitals) : undefined,
      ),
    );
  }

  private toBoardEntry(
    raw: QueueSession,
    doctors: QueueBoardEntry['doctor'][],
    hospitals: QueueBoardEntry['hospital'][],
  ): QueueBoardEntry {
    const session = normalise(raw);
    const waitingNumbers = [...session.waiting].sort((a, b) => a - b);
    const slotsLeft =
      session.maxSlots === null ? null : Math.max(0, session.maxSlots - session.lastIssued);
    return {
      session,
      doctor: doctors.find((d) => d?.id === session.doctorId),
      hospital: hospitals.find((h) => h?.id === session.hospitalId),
      waiting: waitingNumbers.length,
      waitingNumbers,
      slotsLeft,
      acceptingNewPatients: session.status === 'open' && slotsLeft !== 0,
      estimatedWaitMinutes: waitingNumbers.length * session.avgMinutesPerPatient,
    };
  }

  /** Deterministic id keeps one doctor to one queue per hospital per day. */
  static sessionId(doctorId: string, hospitalId: string, date: string): string {
    return `${doctorId}__${hospitalId}__${date}`;
  }

  async openSession(
    input: Omit<QueueSession, 'id' | 'nowServing' | 'lastIssued' | 'updatedAt' | 'status'> &
      Partial<Pick<QueueSession, 'status'>>,
  ): Promise<string> {
    const id = QueueService.sessionId(input.doctorId, input.hospitalId, input.date);
    const ref = doc(this.db, 'queues', id);
    if ((await getDoc(ref)).exists()) {
      throw new Error('This doctor already has a queue at this hospital today.');
    }
    const session: Omit<QueueSession, 'id'> = {
      ...input,
      status: input.status ?? 'open',
      nowServing: 0,
      lastIssued: 0,
      updatedAt: Date.now(),
    };
    await setDoc(ref, session);
    return id;
  }

  /**
   * Hand the next number to a walk-in. Runs in a transaction so two front desks
   * clicking at once can never issue the same number.
   */
  async issueNumber(sessionId: string): Promise<number> {
    return runTransaction(this.db, async (tx) => {
      const ref = doc(this.db, 'queues', sessionId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Queue not found.');
      const session = normalise(snap.data() as QueueSession);

      if (session.status !== 'open') {
        throw new Error('This queue is not accepting patients.');
      }
      if (session.maxSlots !== null && session.lastIssued >= session.maxSlots) {
        throw new Error('All slots for today have been issued.');
      }

      const lastIssued = session.lastIssued + 1;
      const reachedCap = session.maxSlots !== null && lastIssued >= session.maxSlots;
      tx.update(ref, {
        lastIssued,
        waiting: [...session.waiting, lastIssued],
        called: session.called,
        // Closing the queue the moment the last slot goes out is what stops
        // patients from travelling to a clinic that can no longer see them.
        status: reachedCap ? 'cutoff' : session.status,
        updatedAt: Date.now(),
      });
      return lastIssued;
    });
  }

  /** Call the lowest waiting number — the ordinary case, nobody jumps. */
  async callNext(sessionId: string): Promise<number> {
    return this.call(sessionId, null);
  }

  /**
   * Call a specific waiting number ahead of the others: the patient who cannot wait, or the one
   * whose turn was missed. Recorded as a priority call so the public board can say so rather than
   * appear to have skipped people at random.
   */
  async callNumber(sessionId: string, number: number): Promise<number> {
    return this.call(sessionId, number);
  }

  private async call(sessionId: string, requested: number | null): Promise<number> {
    return runTransaction(this.db, async (tx) => {
      const ref = doc(this.db, 'queues', sessionId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Queue not found.');
      const session = normalise(snap.data() as QueueSession);

      if (!session.waiting.length) throw new Error('Nobody is waiting.');

      const next = requested ?? Math.min(...session.waiting);
      if (!session.waiting.includes(next)) {
        throw new Error(`Number ${next} is not waiting — it may have just been called.`);
      }

      tx.update(ref, {
        nowServing: next,
        waiting: session.waiting.filter((n) => n !== next),
        called: [...session.called, next],
        // "Out of order" means someone with a lower number is still waiting.
        priorityCall: next !== Math.min(...session.waiting),
        updatedAt: Date.now(),
      });
      return next;
    });
  }

  /** Undo the last call: the number goes back to waiting and the previous one is serving again. */
  async callPrevious(sessionId: string): Promise<void> {
    await runTransaction(this.db, async (tx) => {
      const ref = doc(this.db, 'queues', sessionId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Queue not found.');
      const session = normalise(snap.data() as QueueSession);

      if (!session.called.length) throw new Error('Nothing has been called yet.');

      const called = [...session.called];
      const undone = called.pop()!;
      const previous = called[called.length - 1] ?? 0;

      tx.update(ref, {
        nowServing: previous,
        called,
        waiting: [...session.waiting, undone].sort((a, b) => a - b),
        priorityCall: false,
        updatedAt: Date.now(),
      });
    });
  }

  async setStatus(sessionId: string, status: QueueStatus): Promise<void> {
    await updateDoc(doc(this.db, 'queues', sessionId), { status, updatedAt: Date.now() });
  }

  async updateSession(sessionId: string, data: Partial<QueueSession>): Promise<void> {
    await updateDoc(doc(this.db, 'queues', sessionId), { ...data, updatedAt: Date.now() });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'queues', sessionId));
  }
}
