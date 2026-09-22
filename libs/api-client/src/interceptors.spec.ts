import { AuthService } from '@ble-frontend/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatApiErrorMessage,
  getLastTraceId,
  initApiClient,
  OpenAPI,
  resetLastTraceId,
  setLastTraceId,
  withOptimisticLockRetry,
} from './interceptors';

describe('API Client Interceptors', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetLastTraceId();
    sessionStorage.clear();
  });

  describe('initApiClient & Request Interceptor', () => {
    it('should configure OpenAPI base URL', () => {
      initApiClient('https://api.banking-ledger.com/v1');
      expect(OpenAPI.BASE).toBe('https://api.banking-ledger.com/v1');

      initApiClient({ baseURL: 'http://localhost:8080' });
      expect(OpenAPI.BASE).toBe('http://localhost:8080');
    });

    it('should inject Authorization header when authenticated token exists', async () => {
      initApiClient();
      vi.spyOn(AuthService, 'getToken').mockReturnValue('mock.jwt.token');
      vi.spyOn(AuthService, 'isTokenExpired').mockReturnValue(false);

      const requestFn = OpenAPI.interceptors.request._fns[0];
      const result = await requestFn({ method: 'GET', headers: {} });

      const headers = new Headers(result.headers);
      expect(headers.get('Authorization')).toBe('Bearer mock.jwt.token');
    });

    it('should omit Authorization header when token is absent or expired', async () => {
      initApiClient();
      vi.spyOn(AuthService, 'getToken').mockReturnValue('expired.jwt.token');
      vi.spyOn(AuthService, 'isTokenExpired').mockReturnValue(true);

      const requestFn = OpenAPI.interceptors.request._fns[0];
      const result = await requestFn({ method: 'GET', headers: {} });

      const headers = new Headers(result.headers);
      expect(headers.has('Authorization')).toBe(false);
    });

    it('should inject X-Trace-Id header on all requests and track it', async () => {
      initApiClient();
      const requestFn = OpenAPI.interceptors.request._fns[0];
      const result = await requestFn({ method: 'GET', headers: {} });

      const headers = new Headers(result.headers);
      const traceId = headers.get('X-Trace-Id');

      expect(traceId).toBeTruthy();
      expect(traceId).toMatch(/^[0-9a-f-]+$/);
      expect(getLastTraceId()).toBe(traceId);
    });

    it('should preserve caller-provided X-Trace-Id header', async () => {
      initApiClient();
      const requestFn = OpenAPI.interceptors.request._fns[0];
      const result = await requestFn({
        method: 'GET',
        headers: { 'X-Trace-Id': 'custom-trace-uuid-123' },
      });

      const headers = new Headers(result.headers);
      expect(headers.get('X-Trace-Id')).toBe('custom-trace-uuid-123');
      expect(getLastTraceId()).toBe('custom-trace-uuid-123');
    });

    it('should generate X-Idempotency-Key for mutating requests (POST, PUT, DELETE, PATCH)', async () => {
      initApiClient();
      const requestFn = OpenAPI.interceptors.request._fns[0];

      for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
        const result = await requestFn({ method, headers: {} });
        const headers = new Headers(result.headers);
        const idempotencyKey = headers.get('X-Idempotency-Key');

        expect(idempotencyKey).toBeTruthy();
        expect(idempotencyKey).toMatch(/^[0-9a-f-]+$/);
      }
    });

    it('should NOT generate X-Idempotency-Key for safe read requests (GET, HEAD)', async () => {
      initApiClient();
      const requestFn = OpenAPI.interceptors.request._fns[0];

      const result = await requestFn({ method: 'GET', headers: {} });
      const headers = new Headers(result.headers);

      expect(headers.has('X-Idempotency-Key')).toBe(false);
    });

    it('should preserve existing X-Idempotency-Key on retries or explicit input', async () => {
      initApiClient();
      const requestFn = OpenAPI.interceptors.request._fns[0];

      const result = await requestFn({
        method: 'POST',
        headers: { 'X-Idempotency-Key': 'existing-uuid-key-456' },
      });
      const headers = new Headers(result.headers);

      expect(headers.get('X-Idempotency-Key')).toBe('existing-uuid-key-456');
    });
  });

  describe('Response Interceptor & Trace Tracking', () => {
    it('should capture X-Trace-Id from response headers', async () => {
      initApiClient();
      const responseFn = OpenAPI.interceptors.response._fns[0];

      const mockResponse = new Response('{}', {
        headers: { 'x-trace-id': 'backend-response-trace-789' },
      });

      await responseFn(mockResponse);
      expect(getLastTraceId()).toBe('backend-response-trace-789');
    });

    it('should allow setting and resetting trace ID manually', () => {
      setLastTraceId('manual-trace-id');
      expect(getLastTraceId()).toBe('manual-trace-id');

      resetLastTraceId();
      expect(getLastTraceId()).toBeNull();
    });
  });

  describe('withOptimisticLockRetry (Doc 02 §7.4)', () => {
    it('should return result directly when operation succeeds on first attempt', async () => {
      const op = vi.fn().mockResolvedValue({ id: 'tx-1', status: 'COMMITTED' });

      const result = await withOptimisticLockRetry(op);
      expect(result).toEqual({ id: 'tx-1', status: 'COMMITTED' });
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('should retry on HTTP 409 conflict and succeed on second attempt', async () => {
      const conflictError = {
        response: {
          status: 409,
          data: { code: 'CONCURRENT_MODIFICATION', message: 'Optimistic lock conflict' },
        },
      };

      const op = vi
        .fn()
        .mockRejectedValueOnce(conflictError)
        .mockResolvedValueOnce({ id: 'tx-2', status: 'COMMITTED' });

      const onRetry = vi.fn();

      const result = await withOptimisticLockRetry(op, {
        delaysMs: [10, 20],
        onRetry,
      });

      expect(result).toEqual({ id: 'tx-2', status: 'COMMITTED' });
      expect(op).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, conflictError, expect.any(Number));
    });

    it('should throw after exceeding maxRetries on continuous 409 conflict', async () => {
      const conflictError = {
        response: {
          status: 409,
          data: { code: 'OPTIMISTIC_LOCK_CONFLICT' },
        },
      };

      const op = vi.fn().mockRejectedValue(conflictError);

      await expect(
        withOptimisticLockRetry(op, { maxRetries: 2, delaysMs: [5, 10] }),
      ).rejects.toEqual(conflictError);

      expect(op).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should NOT retry non-409 errors (e.g. 422 insufficient funds)', async () => {
      const fundsError = {
        response: {
          status: 422,
          data: { code: 'INSUFFICIENT_FUNDS', message: 'Balance too low' },
        },
      };

      const op = vi.fn().mockRejectedValue(fundsError);

      await expect(withOptimisticLockRetry(op, { maxRetries: 2 })).rejects.toEqual(fundsError);
      expect(op).toHaveBeenCalledTimes(1);
    });
  });

  describe('formatApiErrorMessage (Doc 02 §7.3)', () => {
    it('should format message with code, message, and traceId', () => {
      const error = {
        response: {
          status: 422,
          data: {
            code: 'INSUFFICIENT_FUNDS',
            message: 'Available balance is insufficient.',
            traceId: 'c4b12a89-0f41-456e-8d2b-1029384756ab',
          },
        },
      };

      const formatted = formatApiErrorMessage(error);
      expect(formatted).toBe(
        'Error INSUFFICIENT_FUNDS: Available balance is insufficient. (Trace ID: c4b12a89-0f41-456e-8d2b-1029384756ab)',
      );
    });
  });
});
