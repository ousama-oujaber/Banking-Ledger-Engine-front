import { describe, it, expect } from 'vitest';
import { parseBackendError } from './types';

describe('parseBackendError', () => {
  it('handles null/undefined error', () => {
    const err = parseBackendError(null);
    expect(err.status).toBe(500);
    expect(err.code).toBe('UNKNOWN_ERROR');
    expect(err.traceId).toBe('N/A');
  });

  it('maps HTTP 409 Concurrent Modification error correctly', () => {
    const error = {
      status: 409,
      body: {
        code: 'CONCURRENT_MODIFICATION',
        message: 'Version mismatch detected',
        traceId: 'trace-409-uuid',
      },
    };

    const err = parseBackendError(error);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONCURRENT_MODIFICATION');
    expect(err.message).toBe('Version mismatch detected');
    expect(err.traceId).toBe('trace-409-uuid');
  });

  it('provides default message for 409 if backend omitted message', () => {
    const error = {
      status: 409,
      body: {},
    };

    const err = parseBackendError(error);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONCURRENT_MODIFICATION');
    expect(err.message).toContain('Account balance was updated in another session');
  });

  it('maps HTTP 422 Unprocessable Entity with specific domain codes', () => {
    const error = {
      status: 422,
      body: {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient balance to complete transfer',
        traceId: 'trace-422-uuid',
      },
    };

    const err = parseBackendError(error);
    expect(err.status).toBe(422);
    expect(err.code).toBe('INSUFFICIENT_FUNDS');
    expect(err.message).toBe('Insufficient balance to complete transfer');
    expect(err.traceId).toBe('trace-422-uuid');
  });

  it('maps HTTP 429 Rate Limit error', () => {
    const error = {
      status: 429,
      body: {
        traceId: 'trace-429-uuid',
      },
    };

    const err = parseBackendError(error);
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.message).toContain('Rate limit exceeded');
    expect(err.traceId).toBe('trace-429-uuid');
  });

  it('extracts traceId from response headers if body does not have it', () => {
    const error = {
      response: {
        status: 500,
        headers: { 'x-trace-id': 'header-trace-123' },
        data: { message: 'Internal server error' },
      },
    };

    const err = parseBackendError(error);
    expect(err.status).toBe(500);
    expect(err.traceId).toBe('header-trace-123');
    expect(err.message).toBe('Internal server error');
  });

  it('handles standard Error instance fallback', () => {
    const standardError = new Error('Client connection reset');
    const err = parseBackendError(standardError);

    expect(err.status).toBe(500);
    expect(err.code).toBe('SERVER_ERROR');
    expect(err.message).toBe('Client connection reset');
    expect(err.traceId).toBe('N/A');
  });

  it('extracts retryAfter seconds for 429 Too Many Requests from headers or body', () => {
    const axiosError = {
      response: {
        status: 429,
        headers: { 'retry-after': '30' },
        data: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          traceId: 'trace-429',
        },
      },
    };
    const parsed = parseBackendError(axiosError);
    expect(parsed.status).toBe(429);
    expect(parsed.retryAfter).toBe(30);

    const bodyError = {
      status: 429,
      body: {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 15,
      },
    };
    const parsedBody = parseBackendError(bodyError);
    expect(parsedBody.retryAfter).toBe(15);
  });

  it('flags concurrent modification as optimistic lock for HTTP 409', () => {
    const axiosError = {
      response: {
        status: 409,
        data: {
          code: 'CONCURRENT_MODIFICATION',
          message: 'Optimistic lock failure',
          traceId: 'trace-409',
        },
      },
    };
    const parsed = parseBackendError(axiosError);
    expect(parsed.status).toBe(409);
    expect(parsed.isOptimisticLock).toBe(true);
  });

  it('extracts fieldErrors from backend validation response', () => {
    const validationError = {
      response: {
        status: 400,
        data: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors: {
            amount: 'Amount must be positive',
            toAccountId: 'Account not found',
          },
        },
      },
    };
    const parsed = parseBackendError(validationError);
    expect(parsed.fieldErrors).toEqual({
      amount: 'Amount must be positive',
      toAccountId: 'Account not found',
    });
  });
});
