import { Component } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';

@Component({
  selector: 'ble-layout',
  standalone: true,
  template: `
    <div class="admin-layout">
      <nav class="sidebar">
        <h2>BLE Admin</h2>
        <button (click)="navigate('accounts')">Accounts</button>
        <button (click)="navigate('audit')">Audit Trail</button>
        <button (click)="navigate('hold')">Holds</button>
        <button (click)="navigate('recon')">Reconciliation</button>
        <button (click)="navigate('dlq')">DLQ</button>
        <button (click)="navigate('rules')">Rules</button>
        <button (click)="logout()">Logout</button>
      </nav>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .admin-layout { display: flex; height: 100vh; }
    .sidebar { width: 240px; background: #1a1a2e; color: #eee; padding: 1rem; }
    .content { flex: 1; padding: 1rem; overflow: auto; }
    button { display: block; width: 100%; margin: 0.25rem 0; padding: 0.5rem; border: none; background: #16213e; color: #eee; cursor: pointer; }
    button:hover { background: #0f3460; }
  `]
})
export class LayoutComponent {
  constructor(private router: Router) {}

  navigate(path: string): void {
    this.router.navigate([path]);
  }

  logout(): void {
    localStorage.removeItem('ble_auth_token');
    this.router.navigate(['/login']);
  }
}
