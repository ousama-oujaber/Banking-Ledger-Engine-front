import { JwtTokenClaims } from './types';

/**
 * AuthService manages the JWT session lifecycle.
 * Token is stored in sessionStorage — cleared on tab close.
 */
export class AuthService {
  private static TOKEN_KEY = 'ble_auth_token';

  static setToken(token: string): void {
    sessionStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  static getClaims(): JwtTokenClaims | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payloadBase64 = token.split('.')[1];
      return JSON.parse(atob(payloadBase64)) as JwtTokenClaims;
    } catch {
      return null;
    }
  }

  static isTokenExpired(): boolean {
    const claims = this.getClaims();
    if (!claims) return true;
    return Date.now() >= claims.exp * 1000;
  }

  static hasRole(role: string): boolean {
    const claims = this.getClaims();
    return !!claims && claims.roles.includes(role);
  }

  static hasAnyRole(...roles: string[]): boolean {
    const claims = this.getClaims();
    return !!claims && roles.some((r) => claims.roles.includes(r));
  }

  static hasPermission(permission: string): boolean {
    const claims = this.getClaims();
    return !!claims && claims.permissions.includes(permission);
  }

  static clear(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
  }
}
