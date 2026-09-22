import { AuthService } from './auth.service';
import { decodeJwt, isJwtExpired } from './jwt';

/**
 * Returns an HTTP header object with the Authorization Bearer token injected if available and valid.
 *
 * @param token Optional token override; defaults to active token from AuthService.
 */
export function getAuthorizationHeader(token?: string | null): Record<string, string> {
  const effectiveToken = token !== undefined ? token : AuthService.getToken();
  if (!effectiveToken) {
    return {};
  }

  // Check expiration of the specific effective token
  const claims = decodeJwt(effectiveToken);
  if (!claims || isJwtExpired(claims)) {
    return {};
  }

  return { Authorization: `Bearer ${effectiveToken}` };
}

/**
 * Merges the active session's Authorization header into existing HeadersInit.
 * Will not overwrite an existing explicit Authorization header.
 *
 * @param headers Existing headers to augment
 * @param token Optional token override
 */
export function withAuthHeaders(headers?: HeadersInit, token?: string | null): Headers {
  const merged = new Headers(headers);
  if (!merged.has('Authorization')) {
    const effectiveToken = token !== undefined ? token : AuthService.getToken();
    if (effectiveToken) {
      const claims = decodeJwt(effectiveToken);
      if (claims && !isJwtExpired(claims)) {
        merged.set('Authorization', `Bearer ${effectiveToken}`);
      }
    }
  }
  return merged;
}

/**
 * Creates a fetch wrapper that automatically attaches the Authorization Bearer header
 * to outgoing HTTP requests whenever a valid session exists.
 *
 * @param customFetch Underlying fetch implementation; defaults to global window.fetch or globalThis.fetch
 */
export function createFetchWithAuth(customFetch: typeof fetch = globalThis.fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = withAuthHeaders(init?.headers);
    return customFetch(input, {
      ...init,
      headers,
    });
  };
}
