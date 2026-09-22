import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService, AuthGuard } from '@ble-frontend/auth';

/**
 * Angular route guard: requires OPERATOR, AUDITOR, or ADMIN role.
 * Redirects to /login if unauthenticated, blocks if CUSTOMER.
 */
@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    if (!AuthGuard.requireAuth()) {
      this.router.navigate(['/login']);
      return false;
    }
    if (!AuthGuard.isOperator() && !AuthGuard.isAuditor()) {
      this.router.navigate(['/access-denied']);
      return false;
    }
    return true;
  }
}

/**
 * Simple guard that requires any authenticated user.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuardImpl implements CanActivate {
  canActivate(): boolean {
    return AuthGuard.requireAuth();
  }
}
