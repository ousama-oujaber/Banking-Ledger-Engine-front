import { Component, signal, computed, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthGuard } from '@ble-frontend/auth';

@Component({
  selector: 'ble-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-container">
      <form (ngSubmit)="onSubmit()" class="login-form">
        <h1 class="login-form__title">Banking Ledger Engine — Admin</h1>

        <input
          class="login-form__input"
          placeholder="Username"
          [ngModel]="username()"
          (ngModelChange)="username.set($event)"
          name="username"
          required
          [disabled]="isLockedOut() || loading()"
        />

        <input
          class="login-form__input"
          type="password"
          placeholder="Password"
          [ngModel]="password()"
          (ngModelChange)="password.set($event)"
          name="password"
          required
          [disabled]="isLockedOut() || loading()"
        />

        @if (error()) {
          <div class="login-form__error" role="alert" aria-live="polite">
            <p>{{ error() }}</p>
            @if (isLockedOut()) {
              <p class="login-form__countdown">Retry in: {{ formatCountdown(lockoutSeconds()) }}</p>
            }
          </div>
        }

        <button class="login-form__submit" type="submit" [disabled]="loading() || isLockedOut()">
          {{ loading() ? 'Logging in...' : isLockedOut() ? 'Locked' : 'Login' }}
        </button>
      </form>
    </div>
  `,
})
export class LoginComponent implements OnDestroy {
  username = signal('');
  password = signal('');
  error = signal<string | null>(null);
  loading = signal(false);
  lockoutSeconds = signal(0);
  isLockedOut = computed(() => this.lockoutSeconds() > 0);

  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor(private router: Router) {}

  formatCountdown(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;
  }

  private startCountdown(seconds: number): void {
    this.lockoutSeconds.set(seconds);
    if (this.timerId) {
      clearInterval(this.timerId);
    }
    this.timerId = setInterval(() => {
      const current = this.lockoutSeconds();
      if (current <= 1) {
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = null;
        this.lockoutSeconds.set(0);
      } else {
        this.lockoutSeconds.set(current - 1);
      }
    }, 1000);
  }

  async onSubmit(): Promise<void> {
    if (this.isLockedOut()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await fetch('/api/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username(),
          password: this.password(),
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          let retryAfter = 300;
          const retryHeader = res.headers.get('Retry-After');
          if (retryHeader) {
            const parsed = parseInt(retryHeader, 10);
            if (!isNaN(parsed) && parsed > 0) retryAfter = parsed;
          } else {
            try {
              const body = await res.json();
              if (typeof body.retryAfter === 'number' && body.retryAfter > 0) {
                retryAfter = body.retryAfter;
              }
            } catch {
              // ignore body json error
            }
          }
          this.startCountdown(retryAfter);
          this.error.set(`Too many attempts. Try again in ${this.formatCountdown(retryAfter)}.`);
          return;
        }

        if (res.status === 401) {
          this.error.set('Invalid username or password.');
          return;
        }

        let message = 'Login failed. Please try again.';
        try {
          const body = await res.json();
          if (body.message) message = body.message;
        } catch {
          // ignore
        }
        this.error.set(message);
        return;
      }

      const data = await res.json();
      AuthService.setToken(data.token);

      // Verify back-office roles
      const hasBackOfficeAccess =
        AuthGuard.isOperator() ||
        AuthGuard.isAuditor() ||
        AuthGuard.isAdmin() ||
        AuthService.hasRole('SYSTEM');

      if (!hasBackOfficeAccess) {
        AuthService.clear();
        this.error.set('Access denied. Customer accounts cannot access the Back-Office Console.');
        return;
      }

      this.router.navigate(['/']);
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.error.set(err.message);
      } else {
        this.error.set('An unexpected connection error occurred.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
