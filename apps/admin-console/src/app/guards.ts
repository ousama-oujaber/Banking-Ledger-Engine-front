import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  CanActivateFn,
  Router,
  UrlTree,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService, AuthGuard } from '@ble-frontend/auth';

/**
 * Functional Angular 19 route guard: requires back-office privileges.
 * Permitted roles: OPERATOR, AUDITOR, ADMIN, SYSTEM.
 * - Redirects to /login if unauthenticated.
 * - Redirects to /access-denied if authenticated without back-office roles (e.g. CUSTOMER).
 */
export const roleGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot,
): boolean | UrlTree => {
  const router = inject(Router);

  if (!AuthGuard.requireAuth()) {
    return router.createUrlTree(['/login']);
  }

  const isPermitted =
    AuthGuard.isOperator() ||
    AuthGuard.isAuditor() ||
    AuthGuard.isAdmin() ||
    AuthService.hasRole('SYSTEM');

  if (!isPermitted) {
    return router.createUrlTree(['/access-denied']);
  }

  return true;
};

/**
 * Functional Angular 19 route guard: requires any active authenticated session.
 */
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot,
): boolean | UrlTree => {
  const router = inject(Router);

  if (!AuthGuard.requireAuth()) {
    return router.createUrlTree(['/login']);
  }

  return true;
};

/**
 * Legacy class-based wrapper for role checking to maintain backward compatibility.
 */
@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    if (!AuthGuard.requireAuth()) {
      this.router.navigate(['/login']);
      return false;
    }
    const isPermitted =
      AuthGuard.isOperator() ||
      AuthGuard.isAuditor() ||
      AuthGuard.isAdmin() ||
      AuthService.hasRole('SYSTEM');

    if (!isPermitted) {
      this.router.navigate(['/access-denied']);
      return false;
    }
    return true;
  }
}

/**
 * Legacy class-based wrapper for general authentication.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuardImpl implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    if (!AuthGuard.requireAuth()) {
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }
}
