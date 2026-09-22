import { JwtTokenClaims } from './types';

/**
 * Normalizes a base64url-encoded string to standard base64 with proper padding.
 */
export function base64UrlToBase64(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  if (padLength > 0) {
    base64 += '='.repeat(padLength);
  }
  return base64;
}

/**
 * Safely decodes a base64 string to a UTF-8 string across Browser and Node/test environments.
 */
export function decodeBase64ToUtf8(base64: string): string {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    if (typeof TextDecoder !== 'undefined') {
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    }
    // Fallback for older DOM environments without TextDecoder
    return decodeURIComponent(
      Array.prototype.map
        .call(binary, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
  }

  // Node.js fallback if atob is not globally bound
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  throw new Error('No base64 decoding implementation available in current environment');
}

/**
 * Decodes the payload portion of a JSON Web Token (RFC 7519 / RFC 7515).
 * Returns null if the token is malformed, not a valid 3-part JWT, or non-JSON payload.
 */
export function decodeJwt<T = JwtTokenClaims>(token: string | null | undefined): T | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.trim().split('.');
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  try {
    const base64 = base64UrlToBase64(parts[1]);
    const jsonStr = decodeBase64ToUtf8(base64);
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // Normalize roles and permissions if Keycloak nested structure is present
    if (!Array.isArray(parsed['roles'])) {
      const realmAccess = parsed['realm_access'] as { roles?: string[] } | undefined;
      parsed['roles'] = Array.isArray(realmAccess?.roles) ? realmAccess.roles : [];
    }
    if (!Array.isArray(parsed['permissions'])) {
      parsed['permissions'] = [];
    }

    return parsed as unknown as T;
  } catch {
    return null;
  }
}

/**
 * Checks whether the given claims or token is expired.
 *
 * @param claimsOrExp Claims object with an `exp` number or undefined/null
 * @param clockSkewSeconds Optional tolerance in seconds to mitigate clock skew
 */
export function isJwtExpired(
  claimsOrExp: { exp?: number } | number | null | undefined,
  clockSkewSeconds = 0,
): boolean {
  if (claimsOrExp == null) {
    return true;
  }

  const exp = typeof claimsOrExp === 'number' ? claimsOrExp : claimsOrExp.exp;
  if (typeof exp !== 'number' || isNaN(exp)) {
    return true;
  }

  const nowEpochSeconds = Date.now() / 1000;
  return nowEpochSeconds >= exp - clockSkewSeconds;
}

/**
 * Returns the expiration Date of the token claims, or null if invalid or missing.
 */
export function getJwtExpirationDate(
  claimsOrExp: { exp?: number } | number | null | undefined,
): Date | null {
  if (claimsOrExp == null) {
    return null;
  }

  const exp = typeof claimsOrExp === 'number' ? claimsOrExp : claimsOrExp.exp;
  if (typeof exp !== 'number' || isNaN(exp)) {
    return null;
  }

  return new Date(exp * 1000);
}

/**
 * Returns the number of seconds remaining until token expiration (0 if already expired).
 */
export function getJwtRemainingSeconds(
  claimsOrExp: { exp?: number } | number | null | undefined,
): number {
  if (claimsOrExp == null) {
    return 0;
  }

  const exp = typeof claimsOrExp === 'number' ? claimsOrExp : claimsOrExp.exp;
  if (typeof exp !== 'number' || isNaN(exp)) {
    return 0;
  }

  const nowEpochSeconds = Date.now() / 1000;
  const remaining = exp - nowEpochSeconds;
  return remaining > 0 ? Math.floor(remaining) : 0;
}
