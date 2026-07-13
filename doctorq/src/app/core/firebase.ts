import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseOptions, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  DocumentData,
  DocumentReference,
  Firestore,
  Query,
  connectFirestoreEmulator,
  getFirestore,
  onSnapshot,
} from 'firebase/firestore';
import { Observable } from 'rxjs';

export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');

export function provideFirebase(
  options: FirebaseOptions,
  useEmulators = false,
): EnvironmentProviders {
  const app = initializeApp(options);
  const firestore = getFirestore(app);
  const auth = getAuth(app);

  if (useEmulators) {
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }

  return makeEnvironmentProviders([
    { provide: FIRESTORE, useValue: firestore },
    { provide: FIREBASE_AUTH, useValue: auth },
  ]);
}

/** Live collection stream. Unsubscribes from Firestore when the last subscriber leaves. */
export function collection$<T>(query: Query<DocumentData>): Observable<T[]> {
  return new Observable<T[]>((subscriber) =>
    onSnapshot(
      query,
      (snap) => subscriber.next(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
      (err) => subscriber.error(err),
    ),
  );
}

/** Live single-document stream. Emits undefined when the document does not exist. */
export function doc$<T>(ref: DocumentReference<DocumentData>): Observable<T | undefined> {
  return new Observable<T | undefined>((subscriber) =>
    onSnapshot(
      ref,
      (snap) => subscriber.next(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : undefined),
      (err) => subscriber.error(err),
    ),
  );
}
