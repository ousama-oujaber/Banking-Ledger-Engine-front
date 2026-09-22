import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@ble-frontend/auth';

@Component({
  selector: 'ble-login',
  standalone: true,
  template: `
    <div class="login-container">
      <form (ngSubmit)="onSubmit()" class="login-form">
        <h1>Banking Ledger Engine — Admin</h1>
        <input placeholder="Username" [(ngModel)]="username" name="username" required />
        <input type="password" placeholder="Password" [(ngModel)]="password" name="password" required />
        @if (error) { <p class="error">{{ error }}</p> }
        <button type="submit" [disabled]="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
    </div>
  `,
})
export class LoginComponent {
  username = '';
  password = '';
  error?: string;
  loading = false;

  constructor(private router: Router) {}

  async onSubmit() {
    this.loading = true;
    this.error = undefined;
    try {
      // POST /api/v1/auth/token
      const res = await fetch('/api/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.username, password: this.password }),
      });
      if (!res.ok) {
        throw new Error('Invalid credentials');
      }
      const data = await res.json();
      AuthService.setToken(data.token);
      this.router.navigate(['/']);
    } catch (err: any) {
      this.error = err?.status === 429 ? 'Too many attempts. Try again later.' : 'Invalid username or password.';
    } finally {
      this.loading = false;
    }
  }
}
