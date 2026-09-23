/**
 * Decoded payload claims from a JSON Web Token (RFC 7519 / Keycloak format).
 */
export interface JwtTokenClaims {
  /** User principal or customer identifier */
  sub: string;
  /** Granted roles (e.g., 'CUSTOMER', 'OPERATOR', 'ADMIN', 'AUDITOR') */
  roles: string[];
  /** Fine-grained permissions (e.g., 'account:freeze', 'ledger:audit') */
  permissions: string[];
  /** Issued-at timestamp in epoch seconds */
  iat: number;
  /** Expiration timestamp in epoch seconds */
  exp: number;
  /** Issuer URI */
  iss?: string;
  /** Intended audience */
  aud?: string | string[];
  /** User login handle / username */
  preferred_username?: string;
  /** User email address */
  email?: string;
  /** Full display name */
  name?: string;
  /** Additional claims */
  [claim: string]: unknown;
}

/**
 * Normalized authenticated user profile extracted from active JWT claims.
 */
export interface AuthUser {
  /** Unique user ID / Subject */
  id: string;
  /** Username or preferred display handle */
  username: string;
  /** Assigned roles */
  roles: string[];
  /** Granted permissions */
  permissions: string[];
  /** Optional email address */
  email?: string;
  /** Optional display name */
  name?: string;
  /** Underlying raw JWT claims */
  claims: JwtTokenClaims;
}

/**
 * Pluggable key-value storage adapter for persisting tokens.
 * Compatible with Web Storage API (sessionStorage/localStorage) and in-memory caches.
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear?(): void;
}

/**
 * Callback listener invoked when auth token state changes.
 */
export type AuthChangeListener = (token: string | null, claims: JwtTokenClaims | null) => void;
