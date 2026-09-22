import { AuthService } from '@ble-frontend/auth';
import { isOptimisticLockError, parseBackendError } from '@ble-frontend/domain-types';
import { v4 as uuidv4 } from 'uuid';
import { OpenAPI } from './generated/core/OpenAPI';

let lastTraceId: string | null = null;

/**
 * Returns the most recent correlation trace ID captured from API requests or responses.
 */
export function getLastTraceId(): string | null {
  return lastTraceId;
}

/**
 * Sets the active trace ID (useful for testing or manual correlation context).
 */
export function setLastTraceId(traceId: string | null): void {
  lastTraceId = traceId;
}

/**
 * Resets the in-memory trace ID tracker.
 */
export function resetLastTraceId(): void {
  lastTraceId = null;
}

export interface ApiClientConfig {
  baseURL?: string;
  withCredentials?: boolean;
}

/**
 * Configures the auto-generated OpenAPI client and registers HTTP interceptors.
 *
 * Requirements (Doc 02 §4.2):
 * 1. Automatically injects `Authorization: Bearer <jwt>` from `@ble-frontend/auth`.
 * 2. Generates an `X-Idempotency-Key: <uuid-v4>` for mutating requests (POST, PUT, DELETE, PATCH),
 *    while preserving caller-specified keys for safe retries.
 * 3. Appends `X-Trace-Id` for distributed trace correlation.
 * 4. Captures response trace IDs for frontend observability.
 */
export function initApiClient(config: ApiClientConfig | string = 'http://localhost:8080'): void {
  const baseURL = typeof config === 'string' ? config : (config.baseURL ?? 'http://localhost:8080');
  const withCredentials = typeof config === 'object' ? (config.withCredentials ?? false) : false;

  OpenAPI.BASE = baseURL;
  OpenAPI.WITH_CREDENTIALS = withCredentials;
  OpenAPI.CREDENTIALS = 'same-origin';

  // Clear existing interceptors to prevent duplicate stacking during re-inits
  OpenAPI.interceptors.request._fns = [];
  OpenAPI.interceptors.response._fns = [];

  // Request Interceptor
  OpenAPI.interceptors.request.use(async (request) => {
    const headers = new Headers(request.headers as HeadersInit);

    // 1. Authorization: Bearer <token>
    const token = AuthService.getToken();
    if (token && !AuthService.isTokenExpired()) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // 2. X-Trace-Id (distributed correlation)
    const traceId = headers.get('X-Trace-Id') || headers.get('x-trace-id') || uuidv4();
    headers.set('X-Trace-Id', traceId);
    lastTraceId = traceId;

    // 3. X-Idempotency-Key for mutating requests
    const method = (request.method || 'GET').toUpperCase();
    const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (mutatingMethods.includes(method)) {
      const existingKey = headers.get('X-Idempotency-Key') || headers.get('x-idempotency-key');
      if (!existingKey) {
        headers.set('X-Idempotency-Key', uuidv4());
      }
    }

    return {
      ...request,
      headers,
    };
  });

  // Response Interceptor
  OpenAPI.interceptors.response.use(async (response) => {
    const responseTrace = response.headers.get('x-trace-id') || response.headers.get('X-Trace-Id');
    if (responseTrace) {
      lastTraceId = responseTrace;
    }
    return response;
  });
}

export interface OptimisticLockRetryOptions {
  maxRetries?: number;
  delaysMs?: number[];
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Concurrency & Optimistic Lock Conflict Strategy (Doc 02 §7.4):
 * Intercepts HTTP 409 Conflict (ConcurrentModificationException) on operations.
 * Executes up to maxRetries retries with exponential backoff while preserving the operation context.
 */
export async function withOptimisticLockRetry<T>(
  operation: () => Promise<T>,
  options: OptimisticLockRetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const delays = options.delaysMs ?? [100, 300];

  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      const isLockConflict = isOptimisticLockError(error);

      if (isLockConflict && attempt < maxRetries) {
        const baseDelay = delays[attempt] ?? delays[delays.length - 1] ?? 100;
        // Apply slight random jitter: 80% to 120% of base delay
        const jitteredDelay = Math.round(baseDelay * (0.8 + 0.4 * Math.random()));

        options.onRetry?.(attempt + 1, error, jitteredDelay);

        await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
        attempt++;
        continue;
      }

      throw error;
    }
  }
}

/**
 * Formats a user-friendly error message incorporating trace correlation (Doc 02 §7.3).
 */
export function formatApiErrorMessage(error: unknown): string {
  const appError = parseBackendError(error);
  return `Error ${appError.code}: ${appError.message} (Trace ID: ${appError.traceId})`;
}

export { OpenAPI };
