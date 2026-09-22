import { JwtTokenClaims, AuthUser, StorageAdapter, AuthChangeListener } from './types';
import { decodeJwt, isJwtExpired, getJwtExpirationDate, getJwtRemainingSeconds } from './jwt';
import { getEffectiveStorage } from './storage';

/**
 * AuthService manages the client-side JWT session lifecycle,
 * token persistence, claim inspection, and state change listeners.
 */
export class AuthService {
  public static readonly TOKEN_KEY = 'ble_auth_token';

  private static storage: StorageAdapter = getEffectiveStorage();
  private static listeners = new Set<AuthChangeListener>();

  /**
   * Configures a custom storage adapter (e.g. MemoryStorage for isolated tests).
   */
  static setStorageAdapter(adapter: StorageAdapter): void {
    this.storage = adapter;
  }

  /**
   * Returns the currently active storage adapter.
   */
  static getStorageAdapter(): StorageAdapter {
    return this.storage;
  }

  /**
   * Persists an active JWT in storage and notifies registered subscribers.
   */
  static setToken(token: string): void {
    this.storage.setItem(this.TOKEN_KEY, token);
    const claims = decodeJwt(token);
    this.notifyListeners(token, claims);
  }

  /**
   * Retrieves the raw JWT string from storage, or null if unauthenticated.
   */
  static getToken(): string | null {
    return this.storage.getItem(this.TOKEN_KEY);
  }

  /**
   * Decodes and returns the JWT claims for the currently active session.
   */
  static getClaims(): JwtTokenClaims | null {
    const token = this.getToken();
    return decodeJwt(token);
  }

  /**
   * Returns a structured user profile representing the authenticated subject,
   * or null if no valid token exists.
   */
  static getUser(): AuthUser | null {
    const claims = this.getClaims();
    if (!claims) {
      return null;
    }

    return {
      id: claims.sub,
      username: claims.preferred_username || claims.sub,
      roles: claims.roles ?? [],
      permissions: claims.permissions ?? [],
      email: claims.email,
      name: claims.name,
      claims,
    };
  }

  /**
   * Returns true if there is no active token or if the active token has expired.
   *
   * @param clockSkewSeconds Optional tolerance in seconds to mitigate clock skew
   */
  static isTokenExpired(clockSkewSeconds = 0): boolean {
    const claims = this.getClaims();
    if (!claims) {
      return true;
    }
    return isJwtExpired(claims, clockSkewSeconds);
  }

  /**
   * Checks if the active user possesses the specified role.
   */
  static hasRole(role: string): boolean {
    const claims = this.getClaims();
    if (!claims || this.isTokenExpired()) {
      return false;
    }
    return claims.roles.includes(role);
  }

  /**
   * Checks if the active user possesses at least one of the specified roles.
   */
  static hasAnyRole(...roles: string[]): boolean {
    const claims = this.getClaims();
    if (!claims || this.isTokenExpired()) {
      return false;
    }
    return roles.some((r) => claims.roles.includes(r));
  }

  /**
   * Checks if the active user possesses all of the specified roles.
   */
  static hasAllRoles(...roles: string[]): boolean {
    const claims = this.getClaims();
    if (!claims || this.isTokenExpired()) {
      return false;
    }
    return roles.every((r) => claims.roles.includes(r));
  }

  /**
   * Checks if the active user possesses the specified fine-grained permission.
   */
  static hasPermission(permission: string): boolean {
    const claims = this.getClaims();
    if (!claims || this.isTokenExpired()) {
      return false;
    }
    return claims.permissions.includes(permission);
  }

  /**
   * Checks if the active user possesses at least one of the specified permissions.
   */
  static hasAnyPermission(...permissions: string[]): boolean {
    const claims = this.getClaims();
    if (!claims || this.isTokenExpired()) {
      return false;
    }
    return permissions.some((p) => claims.permissions.includes(p));
  }

  /**
   * Checks if the active user possesses all of the specified permissions.
   */
  static hasAllPermissions(...permissions: string[]): boolean {
    const claims = this.getClaims();
    if (!claims || this.isTokenExpired()) {
      return false;
    }
    return permissions.every((p) => claims.permissions.includes(p));
  }

  /**
   * Returns the exact Date when the active session expires, or null if unauthenticated.
   */
  static getExpirationDate(): Date | null {
    return getJwtExpirationDate(this.getClaims());
  }

  /**
   * Returns the number of milliseconds remaining until the active session expires.
   */
  static getTimeUntilExpiration(): number {
    return getJwtRemainingSeconds(this.getClaims()) * 1000;
  }

  /**
   * Returns an Authorization header dictionary if a valid non-expired token exists,
   * or an empty object if unauthenticated.
   */
  static getAuthorizationHeader(): Record<string, string> {
    const token = this.getToken();
    if (!token || this.isTokenExpired()) {
      return {};
    }
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Clears the active token from storage and notifies registered subscribers.
   */
  static clear(): void {
    this.storage.removeItem(this.TOKEN_KEY);
    this.notifyListeners(null, null);
  }

  /**
   * Subscribes a listener to token state changes. Returns an unsubscribe teardown function.
   */
  static subscribe(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(token: string | null, claims: JwtTokenClaims | null): void {
    this.listeners.forEach((listener) => {
      try {
        listener(token, claims);
      } catch (err) {
        console.error('Error in AuthChangeListener subscriber:', err);
      }
    });
  }
}
