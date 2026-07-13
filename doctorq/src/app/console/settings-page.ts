import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccessSettings } from '../core/models';
import { SettingsService } from '../core/settings.service';

interface Toggle {
  key: keyof AccessSettings;
  title: string;
  /** What being ON means. Every flag is written so that ON is the permissive, hands-off option. */
  on: string;
  off: string;
  /**
   * The badge wording. Most of these gate an approval, but "may add hospitals" is a plain
   * allow/deny — calling that one "needs approval" would be a lie.
   */
  labels: [onLabel: string, offLabel: string];
  /** Shown when the flag it depends on is off. */
  requires?: keyof AccessSettings;
}

@Component({
  selector: 'app-settings-page',
  imports: [MatIconModule, MatSlideToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly settingsService = inject(SettingsService);
  private readonly snack = inject(MatSnackBar);

  readonly settings = this.settingsService.settings;
  readonly saving = signal<keyof AccessSettings | null>(null);

  readonly toggles: Toggle[] = [
    {
      key: 'autoApproveStaff',
      title: 'New staff accounts',
      on: 'Anyone who signs up can use the console straight away.',
      off: 'New sign-ups can sign in but can do nothing until you approve them on the Approvals page.',
      labels: ['Automatic', 'Needs approval'],
    },
    {
      key: 'autoApproveDoctors',
      title: 'Doctors added by staff',
      on: 'A doctor a staff member adds goes onto the public board immediately.',
      off: "A staff member's new doctor stays private, and no queue can be opened for them, until you approve it.",
      labels: ['Automatic', 'Needs approval'],
    },
    {
      key: 'allowStaffHospitals',
      title: 'Staff may add hospitals',
      on: 'Staff can add hospitals to the shared directory themselves.',
      off: 'Only you maintain the hospital directory. Staff pick from what you have added.',
      labels: ['Allowed', 'Admin only'],
    },
    {
      key: 'autoApproveHospitals',
      title: 'Hospitals added by staff',
      on: 'A hospital a staff member adds is usable immediately.',
      off: 'A hospital a staff member adds waits for your approval before anyone can hold a clinic there.',
      labels: ['Automatic', 'Needs approval'],
      requires: 'allowStaffHospitals',
    },
  ];

  isDisabled(toggle: Toggle): boolean {
    return !!toggle.requires && !this.settings()[toggle.requires];
  }

  async set(toggle: Toggle, value: boolean): Promise<void> {
    this.saving.set(toggle.key);
    try {
      await this.settingsService.update({ [toggle.key]: value });
      const label = value ? toggle.labels[0] : toggle.labels[1];
      this.snack.open(`${toggle.title}: ${label.toLowerCase()}.`, 'Dismiss');
    } catch {
      this.snack.open('Could not save that setting.', 'Dismiss');
    } finally {
      this.saving.set(null);
    }
  }
}
