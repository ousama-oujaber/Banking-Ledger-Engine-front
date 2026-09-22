import { OpenAPI } from './generated/core/OpenAPI';
import { AuthService } from '@ble-frontend/auth';

let _uuidv4: (() => string) | null = null;

async function getUuidv4(): Promise<string> {
  if (_uuidv4) return _uuidv4();
  const mod = await import('uuid');
  _uuidv4 = mod.v4;
  return mod.v4();
}

/**
 * Configures the auto-generated OpenAPI client.
 *
 * The generated fetch client uses an Interceptors<T> pipeline:
 * - request interceptors receive a RequestInit and can mutate headers
 * - response interceptors receive a Response
 *
 * Call `initApiClient()` once at app bootstrap before making API calls.
 */
export function initApiClient(baseURL: string = 'http://localhost:8080'): void {
  OpenAPI.BASE = baseURL;
  OpenAPI.WITH_CREDENTIALS = false;
  OpenAPI.CREDENTIALS = 'same-origin';

  OpenAPI.interceptors.request.use(async (request) => {
    const [token, traceId, idempotencyKey] = await Promise.all([
      (async () => {
        const t = AuthService.getToken();
        return t && !AuthService.isTokenExpired() ? t : null;
      })(),
      getUuidv4(),
      getUuidv4(),
    ]);

    const headers = new Headers(request.headers as HeadersInit);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (mutatingMethods.includes((request.method || 'GET').toUpperCase())) {
      headers.set('X-Idempotency-Key', idempotencyKey);
    }

    headers.set('X-Trace-Id', traceId);

    return {
      ...request,
      headers,
    };
  });
}

export { OpenAPI };
