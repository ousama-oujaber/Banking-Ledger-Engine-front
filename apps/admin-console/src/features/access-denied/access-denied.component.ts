import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@ble-frontend/auth';

@Component({
  selector: 'ble-access-denied',
  standalone: true,
  imports: [],
  template: `
    <div class="access-denied">
      <div class="access-denied__container">
        <h1 class="access-denied__title">Access Denied</h1>
        <p class="access-denied__message">
          You do not have administrative permissions to access the Back-Office Console. Customer
          accounts are restricted to the Customer Portal.
        </p>
        <div class="access-denied__actions">
          <button (click)="logoutAndReturn()" type="button" class="access-denied__button">
            Log Out & Switch Account
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AccessDeniedComponent {
  constructor(private router: Router) {}

  logoutAndReturn(): void {
    AuthService.clear();
    this.router.navigate(['/login']);
  }
}
