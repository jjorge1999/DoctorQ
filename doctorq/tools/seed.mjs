/**
 * Seeds hospitals, doctors, today's queues, and two console accounts:
 * an administrator, and a staff member assigned to a single doctor.
 *
 *   npm run seed            → seeds the local emulator (start it first)
 *   npm run seed -- --live  → seeds a real project, signing in as the admin named by
 *                             SEED_EMAIL / SEED_PASSWORD (which must already be an admin)
 *
 * Every write goes through Firestore rules exactly as the app's do — the script authenticates
 * rather than bypassing them, so a rules mistake shows up here first.
 *
 * Safe to re-run: documents use deterministic ids and are overwritten.
 */
import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const live = process.argv.includes('--live');

const config = {
  apiKey: process.env['FIREBASE_API_KEY'] ?? 'demo-key',
  projectId: process.env['FIREBASE_PROJECT_ID'] ?? 'demo-doctorq',
  appId: process.env['FIREBASE_APP_ID'] ?? '1:000000000000:web:0000000000000000000000',
};

const ADMIN = {
  email: process.env['SEED_EMAIL'] ?? 'admin@doctorq.test',
  password: process.env['SEED_PASSWORD'] ?? 'doctorq123',
  name: 'Alex Admin',
};
const STAFF = {
  email: 'staff@doctorq.test',
  password: 'doctorq123',
  name: 'Front Desk',
  // Deliberately one doctor out of four, so the scoping is visible the moment you sign in.
  doctorIds: ['d-santos'],
};

const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

if (!live) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

const signInOrCreate = async ({ email, password }) => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch {
    return createUserWithEmailAndPassword(auth, email, password);
  }
};

/**
 * The rules forbid anyone from signing themselves up as an admin — which leaves the very first
 * admin to be created out of band. Against the emulator we use its REST endpoint, where the
 * `owner` bearer token bypasses rules. On a live project you promote the first admin by hand in
 * the Firebase console; from then on admins promote each other in the Staff page.
 */
const bootstrapAdminProfile = async (uid) => {
  const url =
    `http://127.0.0.1:8080/v1/projects/${config.projectId}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        email: { stringValue: ADMIN.email },
        displayName: { stringValue: ADMIN.name },
        role: { stringValue: 'admin' },
        doctorIds: { arrayValue: { values: [] } },
        createdAt: { integerValue: String(Date.now()) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Could not bootstrap the admin profile: ${await res.text()}`);
};

const admin = await signInOrCreate(ADMIN);
if (live) {
  console.log(`Signed in as ${ADMIN.email}. This account must already hold role: 'admin'.`);
} else {
  await bootstrapAdminProfile(admin.user.uid);
  // Re-sign-in so the rules see the freshly written profile on every subsequent write.
  await signInWithEmailAndPassword(auth, ADMIN.email, ADMIN.password);
}

const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const hospitals = [
  {
    id: 'h-stluke',
    name: "St. Luke's Medical Center",
    address: '279 E Rodriguez Sr. Ave, Quezon City',
    city: 'Metro Manila',
    phone: '+63 2 8723 0101',
  },
  {
    id: 'h-makatimed',
    name: 'Makati Medical Center',
    address: '2 Amorsolo St, Legazpi Village',
    city: 'Makati',
    phone: '+63 2 8888 8999',
  },
  {
    id: 'h-cardinal',
    name: 'Cardinal Santos Medical Center',
    address: '10 Wilson St, Greenhills West',
    city: 'San Juan',
    phone: '+63 2 8727 0001',
  },
  {
    id: 'h-manila',
    name: 'Manila Doctors Hospital',
    address: '667 United Nations Ave, Ermita',
    city: 'Manila',
    phone: '+63 2 8558 0888',
  },
  {
    id: 'h-medicity',
    name: 'The Medical City',
    address: 'Ortigas Ave, Pasig',
    city: 'Pasig',
    phone: '+63 2 8988 1000',
  },
  {
    id: 'h-asian',
    name: 'Asian Hospital and Medical Center',
    address: '2205 Civic Dr, Filinvest City',
    city: 'Muntinlupa',
    phone: '+63 2 8771 9000',
  },
];

/** Deterministic per-doctor portrait so re-running the seed doesn't reshuffle faces. */
const photoUrl = (id) => `https://i.pravatar.cc/300?u=${id}`;

const doctors = [
  {
    id: 'd-santos',
    fullName: 'Dr. Maria Santos',
    specialty: 'Cardiology',
    licenseNo: 'PRC-0114523',
    hospitalIds: ['h-stluke', 'h-makatimed'],
    bio: 'Interventional cardiologist. Consultations for hypertension, arrhythmia and post-operative follow-up.',
    photoUrl: photoUrl('d-santos'),
  },
  {
    id: 'd-reyes',
    fullName: 'Dr. Andres Reyes',
    specialty: 'Paediatrics',
    licenseNo: 'PRC-0098311',
    hospitalIds: ['h-makatimed'],
    bio: 'General paediatrics, newborn care and childhood immunisation.',
    photoUrl: photoUrl('d-reyes'),
  },
  {
    id: 'd-lim',
    fullName: 'Dr. Carmen Lim',
    specialty: 'Dermatology',
    licenseNo: 'PRC-0132994',
    hospitalIds: ['h-cardinal', 'h-stluke'],
    bio: 'Medical and surgical dermatology, with a focus on chronic skin conditions.',
    photoUrl: photoUrl('d-lim'),
  },
  {
    id: 'd-tan',
    fullName: 'Dr. Jose Tan',
    specialty: 'Orthopaedics',
    licenseNo: 'PRC-0076140',
    hospitalIds: ['h-cardinal'],
    bio: 'Sports injuries, joint replacement and fracture care.',
    photoUrl: photoUrl('d-tan'),
  },
];

// Extra doctors, one per hospital in rotation, purely to give the board 20 queues of sample
// data to look at. Kept separate from the hand-authored four above for readability.
const extraDoctorSpecs = [
  ['d-cruz', 'Dr. Ramon Cruz', 'Neurology', '0201144'],
  ['d-garcia', 'Dr. Liza Garcia', 'Otolaryngology (ENT)', '0201145'],
  ['d-delacruz', 'Dr. Noel Dela Cruz', 'Endocrinology', '0201146'],
  ['d-mendoza', 'Dr. Grace Mendoza', 'Psychiatry', '0201147'],
  ['d-bautista', 'Dr. Ferdinand Bautista', 'Urology', '0201148'],
  ['d-aquino', 'Dr. Corazon Aquino-Reyes', 'Gastroenterology', '0201149'],
  ['d-torres', 'Dr. Miguel Torres', 'Pulmonology', '0201150'],
  ['d-ramos', 'Dr. Estrella Ramos', 'Nephrology', '0201151'],
  ['d-flores', 'Dr. Benjamin Flores', 'Medical Oncology', '0201152'],
  ['d-castillo', 'Dr. Angelica Castillo', 'Rheumatology', '0201153'],
  ['d-navarro', 'Dr. Ricardo Navarro', 'Ophthalmology', '0201154'],
  ['d-villanueva', 'Dr. Josefina Villanueva', 'Family Medicine', '0201155'],
  ['d-gonzales', 'Dr. Arturo Gonzales', 'General Surgery', '0201156'],
  ['d-pascual', 'Dr. Beatriz Pascual', 'Obstetrics & Gynaecology', '0201157'],
  ['d-santiago', 'Dr. Emmanuel Santiago', 'Internal Medicine', '0201158'],
  ['d-morales', 'Dr. Rosario Morales', 'Anaesthesiology', '0201159'],
].map(([id, fullName, specialty, licenseNo], i) => ({
  id,
  fullName,
  specialty,
  licenseNo: `PRC-${licenseNo}`,
  hospitalIds: [hospitals[i % hospitals.length].id],
  bio: `${specialty} consultations and follow-up care.`,
  photoUrl: photoUrl(id),
}));

doctors.push(...extraDoctorSpecs);

// Deliberately varied so every state on the board is visible after seeding.
const queues = [
  {
    doctorId: 'd-santos',
    hospitalId: 'h-stluke',
    room: '204-B',
    status: 'open',
    nowServing: 12,
    lastIssued: 19,
    maxSlots: 30,
    avgMinutesPerPatient: 12,
    startsAt: '09:00',
    endsAt: '15:00',
    note: '',
  },
  {
    doctorId: 'd-reyes',
    hospitalId: 'h-makatimed',
    room: '3rd Flr, Peds Wing',
    status: 'open',
    nowServing: 4,
    lastIssued: 6,
    maxSlots: null,
    avgMinutesPerPatient: 15,
    startsAt: '10:00',
    endsAt: '17:00',
    note: 'Doctor running about 20 minutes behind.',
  },
  {
    doctorId: 'd-lim',
    hospitalId: 'h-cardinal',
    room: '512',
    status: 'cutoff',
    nowServing: 22,
    lastIssued: 25,
    maxSlots: 25,
    avgMinutesPerPatient: 10,
    startsAt: '08:00',
    endsAt: '13:00',
    note: '',
  },
  {
    doctorId: 'd-tan',
    hospitalId: 'h-cardinal',
    room: '118',
    status: 'paused',
    nowServing: 7,
    lastIssued: 11,
    maxSlots: 20,
    avgMinutesPerPatient: 20,
    startsAt: '13:00',
    endsAt: '18:00',
    note: 'Doctor called to an emergency procedure. Back shortly.',
  },
];

// One queue per extra doctor, cycling through open/paused/cutoff so the board shows every state.
const statusCycle = ['open', 'open', 'paused', 'cutoff'];
const roomCycle = ['1st Flr, OPD', '2nd Flr, Suite B', '3rd Flr, Clinic 7', 'Annex, Room 4'];
queues.push(
  ...extraDoctorSpecs.map((d, i) => {
    const status = statusCycle[i % statusCycle.length];
    const lastIssued = 10 + i;
    return {
      doctorId: d.id,
      hospitalId: d.hospitalIds[0],
      room: roomCycle[i % roomCycle.length],
      status,
      nowServing: status === 'cutoff' ? lastIssued : Math.max(1, lastIssued - 5),
      lastIssued,
      maxSlots: lastIssued + 5,
      avgMinutesPerPatient: 10 + (i % 3) * 5,
      startsAt: '08:00',
      endsAt: '17:00',
      note: status === 'paused' ? 'Doctor on a short break.' : '',
    };
  }),
);

// The access policy. These are the defaults the app assumes when the document is absent; writing
// them explicitly just makes them visible on the Settings page from the first run.
await setDoc(doc(db, 'settings', 'access'), {
  autoApproveStaff: true,
  autoApproveDoctors: true,
  allowStaffHospitals: false,
  autoApproveHospitals: false,
  updatedAt: Date.now(),
});

for (const { id, ...data } of hospitals) {
  await setDoc(doc(db, 'hospitals', id), { ...data, approved: true, createdAt: Date.now() });
}
for (const { id, ...data } of doctors) {
  // Seeded doctors belong to the admin who created them. The staff account below is *assigned*
  // one of them, which is the weaker grant; a staff member's own doctors are the ones they add
  // themselves in the console.
  await setDoc(doc(db, 'doctors', id), {
    ...data,
    ownerUid: admin.user.uid,
    approved: true,
    createdAt: Date.now(),
  });
}
for (const q of queues) {
  const id = `${q.doctorId}__${q.hospitalId}__${today}`;
  await setDoc(doc(db, 'queues', id), { ...q, date: today, updatedAt: Date.now() });
}

console.log(
  `Seeded ${hospitals.length} hospitals, ${doctors.length} doctors and ${queues.length} queues for ${today} ` +
    `(${live ? 'live project ' + config.projectId : 'emulator'}).`,
);

// A scoped staff member, created the same way a real one would be: they sign themselves up
// (landing on role 'staff' with nothing assigned), then an admin attaches a doctor. This runs
// against the emulator and a live project alike — both need a demo staff login to test scoping.
const staff = await signInOrCreate(STAFF);

// Only on first run. Re-writing an existing profile would mean the staff member resetting
// their own doctorIds, which the rules rightly refuse — an admin owns that field.
if (!(await getDoc(doc(db, 'users', staff.user.uid))).exists()) {
  await setDoc(doc(db, 'users', staff.user.uid), {
    email: STAFF.email,
    displayName: STAFF.name,
    role: 'staff',
    doctorIds: [],
    createdAt: Date.now(),
  });
}

await signInWithEmailAndPassword(auth, ADMIN.email, ADMIN.password);
await updateDoc(doc(db, 'users', staff.user.uid), { doctorIds: STAFF.doctorIds });

const assigned = doctors.find((d) => d.id === STAFF.doctorIds[0])?.fullName;
console.log('');
console.log(`Admin  — ${ADMIN.email} / ${ADMIN.password}  (all doctors and hospitals)`);
console.log(`Staff  — ${STAFF.email} / ${STAFF.password}  (${assigned}, assigned by the admin)`);
console.log('         Staff can also add their own doctors — no admin needed.');

process.exit(0);
