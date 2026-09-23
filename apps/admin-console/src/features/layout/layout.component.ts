import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService, AuthUser } from '@ble-frontend/auth';

@Component({
  selector: 'ble-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-layout">
      <nav class="admin-layout__sidebar">
        <div class="admin-layout__brand">
          <h2 class="admin-layout__title">BLE Admin</h2>
          @if (user()) {
            <div class="admin-layout__user">
              <span class="admin-layout__username">{{ user()?.name || user()?.username }}</span>
              <span class="admin-layout__roles">{{ userRolesString() }}</span>
            </div>
          }
        </div>

        <ul class="admin-layout__nav-list">
          <li class="admin-layout__nav-item">
            <a routerLink="/accounts" routerLinkActive="active" class="admin-layout__nav-link"
              >Accounts</a
            >
          </li>
          <li class="admin-layout__nav-item">
            <a routerLink="/audit" routerLinkActive="active" class="admin-layout__nav-link"
              >Audit Trail</a
            >
          </li>
          <li class="admin-layout__nav-item">
            <a routerLink="/holds" routerLinkActive="active" class="admin-layout__nav-link"
              >Holds</a
            >
          </li>
          <li class="admin-layout__nav-item">
            <a routerLink="/recon" routerLinkActive="active" class="admin-layout__nav-link"
              >Reconciliation</a
            >
          </li>
          <li class="admin-layout__nav-item">
            <a routerLink="/dlq" routerLinkActive="active" class="admin-layout__nav-link"
              >DLQ Ops</a
            >
          </li>
          <li class="admin-layout__nav-item">
            <a routerLink="/rules" routerLinkActive="active" class="admin-layout__nav-link"
              >Rules Matrix</a
            >
          </li>
        </ul>

        <div class="admin-layout__footer">
          <button (click)="logout()" type="button" class="admin-layout__logout-btn">Logout</button>
        </div>
      </nav>

      <main class="admin-layout__content">
        <router-outlet />
      </main>
    </div>
  `,
})
export class LayoutComponent {
  user = signal<AuthUser | null>(AuthService.getUser());

  constructor(private router: Router) {}

  userRolesString(): string {
    const roles = this.user()?.roles;
    return roles && roles.length > 0 ? roles.join(', ') : 'Operator';
  }

  logout(): void {
    AuthService.clear();
    this.router.navigate(['/login']);
  }
}
