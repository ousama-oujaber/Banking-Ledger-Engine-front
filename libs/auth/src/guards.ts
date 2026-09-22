import { UserRole } from '@ble-frontend/domain-types';
import { AuthService } from './auth.service';

/**
 * AuthGuard helpers for route protection and RBAC.
 * Used differently in React (route loaders) and Angular (CanActivate / CanMatch).
 */
export class AuthGuard {
  /** Requires any authenticated user */
  static requireAuth(): boolean {
    return !!AuthService.getToken() && !AuthService.isTokenExpired();
  }

  /** Requires a specific role (or any of the provided roles) */
  static requireRole(...roles: string[]): boolean {
    if (!this.requireAuth()) return false;
    return AuthService.hasAnyRole(...roles);
  }

  /** Requires a specific permission */
  static requirePermission(permission: string): boolean {
    if (!this.requireAuth()) return false;
    return AuthService.hasPermission(permission);
  }

  /** Returns the user's roles from the JWT */
  static getUserRoles(): string[] {
    const claims = AuthService.getClaims();
    return claims?.roles ?? [];
  }

  /** Returns true if the user is a customer */
  static isCustomer(): boolean {
    return this.requireRole(UserRole.CUSTOMER);
  }

  /** Returns true if the user is an operator or admin */
  static isOperator(): boolean {
    return this.requireRole(UserRole.OPERATOR, UserRole.ADMIN);
  }

  /** Returns true if the user is an auditor */
  static isAuditor(): boolean {
    return this.requireRole(UserRole.AUDITOR, UserRole.ADMIN);
  }
}
