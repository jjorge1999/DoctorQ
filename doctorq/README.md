# DoctorQ

Live clinic queue board. Patients check the current queue number — and whether the doctor has
already cut off for the day — before travelling to the hospital. Staff run the queue from an
authenticated console.

Angular 22 (standalone, zoneless, signals) + Angular Material 3 + Firebase (Firestore + Auth).

## The two sides

**Public board** (`/`, no sign-in): every clinic running today, with the number now being served,
how many are waiting, slots left, estimated wait, the doctor's profile and the hospital's address
and phone. Clicking a clinic (`/q/:id`) opens the full page, which leads with a plain-language
verdict: *still accepting patients*, *paused*, or *cut-off — don't travel*.

**Staff console** (`/console`, sign-in required):

| Page | Who | What it does |
| --- | --- | --- |
| Queue control | both | Open a queue, hand out numbers, call next, step back, pause / cut-off / close, delete |
| Doctors | both | Profiles: name, specialty, licence, photo, bio, and which hospitals they practise at |
| Hospitals | admin* | Name, address, city, contact number (*staff too, if enabled in Settings) |
| Approvals | admin | Anything held back by an approval gate, to approve or reject |
| Staff | admin | Who can sign in, their role, and which doctors they may run a queue for |
| Settings | admin | The approval gates: what staff can do without asking |

Every write lands on the public board immediately over Firestore snapshots — no polling, no reload.

## Roles

**Staff run themselves.** Someone signs up, adds their own doctor, opens that doctor's queue, and
it is live on the public board — no administrator involved at any step. They see only their own
doctors and queues; other clinics' queues are invisible to them in the console (though of course
public on the board, like everyone's).

**Administrator** — sees and can fix everything: any doctor, any queue, the hospital directory,
and the staff roster.

The one thing staff depend on an admin for is the **hospital directory**, which is shared and
curated so the board doesn't end up with "St. Luke's" spelled four ways. Staff pick from it.

A doctor is held one of two ways, and they are not the same strength:

| | Own (you created them) | Assigned (an admin handed them to you) |
| --- | --- | --- |
| Run their queue | yes | yes |
| Edit their profile | yes | yes |
| Change which hospitals they practise at | yes | no |
| Delete them | yes | no |

Assignment exists for handovers — covering leave, or a shared front desk — not as the way people
get started.

### Approval gates (Settings page, admin only)

How much staff do unsupervised is a policy you set, not something baked in. Four switches in
**Console → Settings**, each one either automatic or "needs my approval":

| Setting | On (default) | Off |
| --- | --- | --- |
| New staff accounts | anyone who signs up can work immediately | they can sign in, but do nothing until approved |
| Doctors added by staff | go straight onto the public board | stay private, and no queue can be opened, until approved |
| Staff may add hospitals | *off by default* — staff can add to the shared directory | only the admin curates it |
| Hospitals added by staff | usable immediately | wait for approval before anyone can hold a clinic there |

Anything held back lands on the **Approvals** page, where the admin approves or rejects it; the
sidebar shows a count of what's waiting. Defaults are the permissive ones, so switching a gate ON
is the deliberate act and an unconfigured project behaves exactly as before.

Gates are enforced in the rules, not just the UI: the `approved` flag on a new signup, doctor or
hospital must equal whatever the policy says, so a hand-crafted request cannot wave itself through
a gate the admin has closed. Nobody can approve their own submission, and a doctor awaiting
approval cannot have a queue opened for them — which is what would otherwise sneak them onto the
public board.

### Enforcement

All of this lives in `firestore.rules`, not in the UI. Hiding a nav item stops an honest mistake;
the rules are what stop someone with the browser console open. Specifically, a staff member cannot:

- create a doctor owned by anybody but themselves (`ownerUid` must be their own uid), or with no
  owner at all;
- take over an existing doctor by rewriting `ownerUid`, or push one onto someone else;
- read or write a doctor, queue, or profile belonging to another staff member;
- add or edit hospitals;
- promote themselves to admin, or assign themselves an extra doctor.

The public board is deliberately **not** scoped: patients see every clinic, no matter who is
signed in.

### The first administrator

Nobody can sign themselves up as an admin — self-registration is pinned to `role: 'staff'`, and the
rules reject anything else. So the first admin is created out of band:

- **Emulator** — `npm run seed` does it for you.
- **Live project** — sign up through the app's *Create account* tab, then open the Firebase console
  and change that user's `users/{uid}` document to `role: "admin"` by hand. From then on, admins
  promote each other from the Staff page.

Note that a project with *no* admin still works for staff — they just have no hospitals to pick
from until someone curates the directory.

## Privacy

The public collections hold **counters only** — `nowServing`, `lastIssued`, `maxSlots`. No patient
name, contact detail or health information is stored anywhere in the app, which is what keeps the
board publishable without HIPAA-style protections. The free-text clinic notice is public too, so it
must never carry patient information; the console says so at the point of entry.

## Run it locally (Firebase emulator, no cloud project needed)

```bash
npm install
npm run emulators   # terminal 1 — Auth on :9099, Firestore on :8080 (needs Java)
npm run seed        # terminal 2 — 3 hospitals, 4 doctors, 4 queues for today
npm start           # terminal 2 — http://localhost:4200
```

The seed prints the two logins it creates, so you can see the scoping immediately:

| Login | Password | Sees |
| --- | --- | --- |
| `admin@doctorq.test` | `doctorq123` | all 4 doctors, hospitals, staff roster |
| `staff@doctorq.test` | `doctorq123` | only Dr. Maria Santos, assigned by the admin |

Or just hit *Create account* and set yourself up from scratch — that path needs no admin at all.

`src/environments/environment.ts` ships with `useEmulators: true`, so the app talks to the local
emulators and the placeholder Firebase keys are enough.

## Point it at a real Firebase project

1. Create a project, then enable **Authentication → Sign-in method → Email/Password** and
   **Firestore Database**.
2. Paste the web app config into `src/environments/environment.production.ts` (and into
   `environment.ts` if you want `npm start` to hit the cloud — set `useEmulators: false` there).
3. Deploy the rules. They are the real access boundary, not the UI:
   ```bash
   npx firebase deploy --only firestore:rules
   ```
4. Create the first staff account through the **Create account** tab on `/login`.

Optional: `npm run build && npx firebase deploy --only hosting`.

## Data model

```
hospitals/{id}   name, address, city, phone
doctors/{id}     fullName, specialty, licenseNo, hospitalIds[], photoUrl, bio, ownerUid
                 ↑ ownerUid is the staff account that created them, and is what makes
                   staff self-sufficient: you manage the doctors you added
queues/{id}      doctorId, hospitalId, date, room, status, nowServing, lastIssued,
                 maxSlots, avgMinutesPerPatient, startsAt, endsAt, note
users/{uid}      email, displayName, role, doctorIds[], approved
                 ↑ existence of this doc grants console access; role and doctorIds scope it
settings/access  autoApproveStaff, autoApproveDoctors, allowStaffHospitals, autoApproveHospitals
```

`approved` is absent-means-true throughout, so records that pre-date the approval gates keep
working and turning a gate on never strands anything already live.

`queues` ids are `{doctorId}__{hospitalId}__{yyyy-MM-dd}`, which is what stops one doctor from
having two queues at the same hospital on the same day.

## How the queue behaves

- `issueNumber` and `callNext` run inside Firestore transactions, so two front desks clicking at
  the same moment cannot issue the same number or skip a patient.
- Issuing the last slot flips the queue to `cutoff` automatically — that is the signal patients
  rely on to stay home.
- `cutoff` stops *new* numbers but still lets staff call the patients already holding one.
