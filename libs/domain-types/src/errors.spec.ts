import { describe, expect, it } from 'vitest';
import {
  CurrencyMismatchException,
  DomainException,
  InvalidAmountException,
  isAccountFrozenError,
  isIdempotencyConflictError,
  isInsufficientFundsError,
  isOptimisticLockError,
  parseBackendError,
} from './errors';

describe('errors & error parsing module', () => {
  describe('parseBackendError', () => {
    it('should parse standard Spring Boot ErrorResponse envelope from Axios response', () => {
      const axiosError = {
        response: {
          status: 422,
          data: {
            code: 'INSUFFICIENT_FUNDS',
            message: 'Available balance is insufficient for transfer.',
            traceId: 'trace-abc-123',
            timestamp: '2026-09-22T10:00:00Z',
            fieldErrors: [{ field: 'amount', message: 'Exceeds balance' }],
          },
        },
      };

      const parsed = parseBackendError(axiosError);
      expect(parsed.status).toBe(422);
      expect(parsed.code).toBe('INSUFFICIENT_FUNDS');
      expect(parsed.message).toBe('Available balance is insufficient for transfer.');
      expect(parsed.traceId).toBe('trace-abc-123');
      expect(parsed.fieldErrors).toHaveLength(1);
      expect(parsed.fieldErrors?.[0].field).toBe('amount');
    });

    it('should parse ApiError with body property', () => {
      const apiError = {
        status: 400,
        body: {
          code: 'BAD_REQUEST',
          message: 'Invalid input',
          traceId: 'tr-999',
        },
      };

      const parsed = parseBackendError(apiError);
      expect(parsed.status).toBe(400);
      expect(parsed.code).toBe('BAD_REQUEST');
      expect(parsed.traceId).toBe('tr-999');
    });

    it('should parse network disconnection errors (status 0)', () => {
      const networkError = {
        code: 'ERR_NETWORK',
        message: 'Network Error',
        request: {},
      };

      const parsed = parseBackendError(networkError);
      expect(parsed.status).toBe(0);
      expect(parsed.code).toBe('NETWORK_ERROR');
      expect(parsed.isNetworkError).toBe(true);
      expect(parsed.traceId).toBe('N/A');
    });

    it('should parse standard native JavaScript Error', () => {
      const jsError = new Error('Something broke');
      const parsed = parseBackendError(jsError);

      expect(parsed.status).toBe(500);
      expect(parsed.code).toBe('INTERNAL_SERVER_ERROR');
      expect(parsed.message).toBe('Something broke');
      expect(parsed.traceId).toBe('N/A');
    });

    it('should gracefully handle null or undefined errors', () => {
      const parsed = parseBackendError(null);
      expect(parsed.status).toBe(500);
      expect(parsed.code).toBe('UNKNOWN_ERROR');
      expect(parsed.traceId).toBe('N/A');
    });

    it('should extract traceId from response headers if not in body', () => {
      const headerError = {
        response: {
          status: 500,
          headers: { 'x-trace-id': 'header-trace-456' },
          data: { message: 'Crash' },
        },
      };

      const parsed = parseBackendError(headerError);
      expect(parsed.traceId).toBe('header-trace-456');
    });

    it('should pass through already-parsed AppError or DomainException', () => {
      const domainEx = new DomainException('Rule violated', 'RULE_VIOLATION', 400, 'tr-dom');
      const parsed = parseBackendError(domainEx);

      expect(parsed.status).toBe(400);
      expect(parsed.code).toBe('RULE_VIOLATION');
      expect(parsed.traceId).toBe('tr-dom');
    });
  });

  describe('error classification predicates', () => {
    it('should identify insufficient funds errors', () => {
      expect(
        isInsufficientFundsError({
          response: { status: 422, data: { code: 'INSUFFICIENT_FUNDS' } },
        }),
      ).toBe(true);
      expect(isInsufficientFundsError({ response: { status: 400, data: { code: 'OTHER' } } })).toBe(
        false,
      );
    });

    it('should identify account frozen errors', () => {
      expect(
        isAccountFrozenError({ response: { status: 403, data: { code: 'ACCOUNT_FROZEN' } } }),
      ).toBe(true);
      expect(
        isAccountFrozenError({ response: { status: 403, data: { code: 'ACCOUNT_NOT_ACTIVE' } } }),
      ).toBe(true);
      expect(isAccountFrozenError({ response: { status: 400, data: { code: 'OTHER' } } })).toBe(
        false,
      );
    });

    it('should identify optimistic lock / concurrency conflicts (Doc 02 §7.4)', () => {
      expect(
        isOptimisticLockError({
          response: { status: 409, data: { code: 'CONCURRENT_MODIFICATION' } },
        }),
      ).toBe(true);
      expect(
        isOptimisticLockError({
          response: { status: 409, data: { code: 'OPTIMISTIC_LOCK_CONFLICT' } },
        }),
      ).toBe(true);
      expect(isOptimisticLockError({ response: { status: 409 } })).toBe(true);
      expect(isOptimisticLockError({ response: { status: 400, data: { code: 'OTHER' } } })).toBe(
        false,
      );
    });

    it('should identify idempotency conflict errors', () => {
      expect(
        isIdempotencyConflictError({ response: { data: { code: 'IDEMPOTENCY_CONFLICT' } } }),
      ).toBe(true);
      expect(
        isIdempotencyConflictError({ response: { data: { code: 'DUPLICATE_IDEMPOTENCY_KEY' } } }),
      ).toBe(true);
      expect(isIdempotencyConflictError({ response: { data: { code: 'OTHER' } } })).toBe(false);
    });
  });

  describe('domain exception hierarchy', () => {
    it('should construct CurrencyMismatchException with appropriate metadata', () => {
      const ex = new CurrencyMismatchException('EUR', 'USD');
      expect(ex.code).toBe('CURRENCY_MISMATCH');
      expect(ex.status).toBe(422);
      expect(ex.message).toContain('EUR');
      expect(ex.message).toContain('USD');
      expect(ex).toBeInstanceOf(DomainException);
      expect(ex).toBeInstanceOf(Error);
    });

    it('should construct InvalidAmountException with 422 status', () => {
      const ex = new InvalidAmountException('Negative amount');
      expect(ex.code).toBe('INVALID_AMOUNT');
      expect(ex.status).toBe(422);
      expect(ex).toBeInstanceOf(DomainException);
    });
  });
});
