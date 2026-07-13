/** Lifecycle of a doctor's clinic queue for a single day. */
export type QueueStatus = 'open' | 'paused' | 'cutoff' | 'closed';

export interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
  photoUrl?: string;
  /** Absent means approved — records that pre-date the approval settings are grandfathered in. */
  approved?: boolean;
  /** Set when a staff member added it; admin-created hospitals have none. */
  ownerUid?: string;
  createdAt?: number;
}

export interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  /** A doctor may hold clinics in more than one hospital. */
  hospitalIds: string[];
  licenseNo?: string;
  photoUrl?: string;
  bio?: string;
  /**
   * The staff account that created this doctor. Owners manage their own doctors without an
   * administrator being involved; admins can manage everyone's.
   */
  ownerUid?: string;
  /**
   * Absent means approved. When `autoApproveDoctors` is off, a staff member's new doctor lands
   * here as `false`: invisible to patients, and no queue can be opened for them, until an admin
   * approves.
   */
  approved?: boolean;
  createdAt?: number;
}

/**
 * One doctor's queue at one hospital on one day.
 * Nothing here identifies a patient, so the public board can render it as-is.
 */
export interface QueueSession {
  id: string;
  doctorId: string;
  hospitalId: string;
  /** yyyy-MM-dd, local time. */
  date: string;
  room?: string;
  status: QueueStatus;
  /** Number currently being seen. Denormalised from the tail of `called` for the public board. */
  nowServing: number;
  /** Highest number handed out so far. */
  lastIssued: number;
  /**
   * Numbers issued but not yet called. Held as an explicit list rather than inferred from
   * `nowServing..lastIssued`, because the front desk can call any of them out of order — a
   * counter alone cannot express "14 is in with the doctor and 12 is still waiting".
   *
   * Absent on queues created before priority calling existed; treat as the plain range.
   */
  waiting?: number[];
  /** Numbers already called, in the order they were called. Absent on older queues. */
  called?: number[];
  /** Whether the number now serving was pulled forward ahead of others. */
  priorityCall?: boolean;
  /** Cap on numbers that may be issued today. null = no cap. */
  maxSlots: number | null;
  avgMinutesPerPatient: number;
  /** HH:mm */
  startsAt?: string;
  endsAt?: string;
  /** Free-text notice shown to patients, e.g. "Doctor running 30 mins late". */
  note?: string;
  updatedAt: number;
}

/** A session joined with its doctor and hospital, for display. */
export interface QueueBoardEntry {
  session: QueueSession;
  doctor: Doctor | undefined;
  hospital: Hospital | undefined;
  /** How many are waiting. */
  waiting: number;
  /** Which numbers are waiting, ascending — the front desk calls one of these. */
  waitingNumbers: number[];
  /** Whether a walk-in can still get a number right now. */
  acceptingNewPatients: boolean;
  slotsLeft: number | null;
  estimatedWaitMinutes: number;
}

export type Role = 'admin' | 'staff';

/**
 * Admin-controlled policy for how much a staff member can do without being waved through.
 * Held in `settings/access`. Every flag defaults to the permissive value, so a project with no
 * settings document behaves exactly as it did before any of this existed.
 */
export interface AccessSettings {
  /** Off: new sign-ups wait for an admin before they can use the console at all. */
  autoApproveStaff: boolean;
  /** Off: a staff member's new doctor stays off the public board until an admin approves it. */
  autoApproveDoctors: boolean;
  /** Whether staff may add hospitals at all. Off: the directory is admin-only. */
  allowStaffHospitals: boolean;
  /** Off: a staff-added hospital waits for an admin before anyone can use it. Ignored unless the above is on. */
  autoApproveHospitals: boolean;
}

export const DEFAULT_ACCESS_SETTINGS: AccessSettings = {
  autoApproveStaff: true,
  autoApproveDoctors: true,
  allowStaffHospitals: false,
  autoApproveHospitals: false,
};

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  /**
   * admin — every doctor, hospital and staff account.
   * staff — the doctors they created, plus any an admin has handed them.
   */
  role: Role;
  /**
   * Doctors an admin has granted this staff member on top of the ones they own.
   * Ignored for admins, who see all.
   */
  doctorIds: string[];
  /**
   * Absent means approved. When `autoApproveStaff` is off, a new sign-up lands here as `false`
   * and can sign in but do nothing until an admin lets them through.
   */
  approved?: boolean;
  createdAt?: number;
}

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  open: 'Accepting patients',
  paused: 'Temporarily paused',
  cutoff: 'Cut-off reached',
  closed: 'Clinic closed',
};
