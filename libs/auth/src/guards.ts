import { UserRole } from '@ble-frontend/domain-types';
import { AuthService } from './auth.service';

/**
 * AuthGuard provides static RBAC and authentication validation methods
 * designed for integration with route guards in React (loaders/guards)
 * and Angular (CanActivate/CanMatch functions).
 */
export class AuthGuard {
  /**
   * Requires an active, non-expired authenticated session.
   *
   * @param clockSkewSeconds Optional tolerance in seconds to mitigate clock skew
   */
  static requireAuth(clockSkewSeconds = 0): boolean {
    const token = AuthService.getToken();
    return !!token && !AuthService.isTokenExpired(clockSkewSeconds);
  }

  /**
   * Requires that the authenticated user possesses at least one of the specified roles.
   */
  static requireRole(...roles: string[]): boolean {
    if (!this.requireAuth()) {
      return false;
    }
    return AuthService.hasAnyRole(...roles);
  }

  /**
   * Requires that the authenticated user possesses all of the specified roles.
   */
  static requireAllRoles(...roles: string[]): boolean {
    if (!this.requireAuth()) {
      return false;
    }
    return AuthService.hasAllRoles(...roles);
  }

  /**
   * Requires that the authenticated user possesses the specified fine-grained permission.
   */
  static requirePermission(permission: string): boolean {
    if (!this.requireAuth()) {
      return false;
    }
    return AuthService.hasPermission(permission);
  }

  /**
   * Requires that the authenticated user possesses all of the specified permissions.
   */
  static requireAllPermissions(...permissions: string[]): boolean {
    if (!this.requireAuth()) {
      return false;
    }
    return AuthService.hasAllPermissions(...permissions);
  }

  /**
   * Returns the list of roles assigned to the currently authenticated user.
   */
  static getUserRoles(): string[] {
    const claims = AuthService.getClaims();
    return claims?.roles ?? [];
  }

  /**
   * Returns the list of permissions assigned to the currently authenticated user.
   */
  static getUserPermissions(): string[] {
    const claims = AuthService.getClaims();
    return claims?.permissions ?? [];
  }

  /**
   * Returns true if the active user possesses the CUSTOMER role.
   */
  static isCustomer(): boolean {
    return this.requireRole(UserRole.CUSTOMER);
  }

  /**
   * Returns true if the active user possesses either the OPERATOR or ADMIN role.
   */
  static isOperator(): boolean {
    return this.requireRole(UserRole.OPERATOR, UserRole.ADMIN);
  }

  /**
   * Returns true if the active user possesses either the AUDITOR or ADMIN role.
   */
  static isAuditor(): boolean {
    return this.requireRole(UserRole.AUDITOR, UserRole.ADMIN);
  }

  /**
   * Returns true if the active user possesses the ADMIN role.
   */
  static isAdmin(): boolean {
    return this.requireRole(UserRole.ADMIN);
  }
}
