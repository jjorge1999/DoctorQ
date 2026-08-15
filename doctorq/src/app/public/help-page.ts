import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PublicHeader } from '../shared/public-header';

export interface FaqEntry {
  q: string;
  a: string;
}

const PATIENT_FAQS: FaqEntry[] = [
  {
    q: 'What does the queue number mean?',
    a: 'Every patient who takes a slot gets the next number in line. "Now serving" is the number currently with the doctor; "last number issued" is the highest number handed out so far.',
  },
  {
    q: 'What do "open", "paused", "cut-off" and "closed" mean?',
    a: '"Open" — still accepting patients. "Paused" — the doctor has stepped away; numbers already issued keep their place. "Cut-off" — every slot for today is gone; do not travel if you do not already hold a number. "Closed" — the clinic has ended for the day.',
  },
  {
    q: 'How is the estimated wait calculated?',
    a: 'The number of patients still waiting, multiplied by the average minutes this doctor spends per patient. It is an estimate, not a promise.',
  },
  {
    q: 'Do I need a physical ticket?',
    a: 'No. This page is the ticket — there is nothing to print or collect at the front desk. Just watch this page for your number.',
  },
  {
    q: 'What if cut-off is reached before I arrive?',
    a: 'Do not travel to the hospital. Once a queue reaches its daily cap it will not see any further walk-ins, even if you have not been issued a number yet.',
  },
  {
    q: 'Is my information shown on this board?',
    a: 'No. This board shows queue numbers only — never patient names or health information.',
  },
];

const STAFF_FAQS: FaqEntry[] = [
  {
    q: 'How do I open a queue for a doctor?',
    a: 'From Queue control, start a new queue for a doctor at a hospital. A doctor can only have one open queue per hospital per day.',
  },
  {
    q: 'How do I hand out the next number?',
    a: 'Use "Issue number" to give a walk-in the next sequential number.',
  },
  {
    q: 'How do I call a patient?',
    a: '"Call next" calls the lowest waiting number. To call a specific patient out of turn — someone who cannot wait, or was missed — use "Call number" instead; the board marks it as a priority call so nobody looks skipped.',
  },
  {
    q: 'I called the wrong number — can I undo it?',
    a: 'Yes. "Call previous" puts the last-called number back into the waiting list and returns to serving the one before it.',
  },
  {
    q: 'How do I pause or close a queue?',
    a: 'Pausing keeps issued numbers in place while new ones wait; closing ends the clinic day. Both are set from Queue control, along with the room, hours, capacity and a note patients see on their queue page.',
  },
  {
    q: 'How do I add a doctor or a hospital?',
    a: 'From the Doctors or Hospitals pages. Doctors and hospitals you add are yours to manage; an administrator can see and manage every doctor and hospital.',
  },
];

const ADMIN_FAQS: FaqEntry[] = [
  {
    q: 'What shows up in Approvals?',
    a: 'New staff sign-ups, and doctors or hospitals added by staff, when auto-approval is off for that type. Nothing there is visible to patients until you approve it.',
  },
  {
    q: 'How do I manage staff accounts?',
    a: 'From the Staff page: assign doctors to a staff member, promote another account to admin, or remove access.',
  },
  {
    q: 'What do the access settings control?',
    a: 'Whether new staff sign-ups and staff-added doctors/hospitals need your approval before they can be used, from the Settings page.',
  },
];

@Component({
  selector: 'app-help-page',
  imports: [MatButtonModule, MatExpansionModule, MatIconModule, RouterLink, PublicHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help-page.html',
  styleUrl: './help-page.scss',
})
export class HelpPage {
  private readonly auth = inject(AuthService);

  readonly isSignedIn = this.auth.isSignedIn;
  readonly isApproved = this.auth.isApproved;
  readonly isAdmin = this.auth.isAdmin;

  readonly patientFaqs = PATIENT_FAQS;
  readonly staffFaqs = STAFF_FAQS;
  readonly adminFaqs = computed(() => (this.isAdmin() ? ADMIN_FAQS : []));

  readonly showStaffSection = computed(() => this.isSignedIn() && this.isApproved());
  readonly showPendingNotice = computed(() => this.isSignedIn() && !this.isApproved());
  readonly showSignInCallout = computed(() => !this.isSignedIn());

  readonly sectionCount = computed(() => 1 + (this.showStaffSection() ? 1 : 0));
}
