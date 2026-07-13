import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService, NoConsoleAccessError } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTabsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly signInForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly registerForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async signIn(): Promise<void> {
    if (this.signInForm.invalid || this.busy()) return;
    const { email, password } = this.signInForm.getRawValue();
    await this.run(() => this.auth.signIn(email, password));
  }

  async register(): Promise<void> {
    if (this.registerForm.invalid || this.busy()) return;
    const { name, email, password } = this.registerForm.getRawValue();
    await this.run(() => this.auth.register(name, email, password));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      const next = this.route.snapshot.queryParamMap.get('next') ?? '/console';
      await this.router.navigateByUrl(next);
    } catch (err) {
      this.error.set(this.messageFor(err));
    } finally {
      this.busy.set(false);
    }
  }

  private messageFor(err: unknown): string {
    if (err instanceof NoConsoleAccessError) return err.message;
    if (!(err instanceof FirebaseError)) {
      return 'Something went wrong. Please try again.';
    }
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'That email and password combination is not recognised.';
      case 'auth/email-already-in-use':
        return 'An account already exists for that email. Sign in instead.';
      case 'auth/weak-password':
        return 'Choose a password of at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Cannot reach Firebase. Check your connection and project configuration.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not enabled on this Firebase project.';
      default:
        return err.message;
    }
  }
}
