import { describe, it, expect } from 'vitest';
import { createQueryClient, shouldRetryQuery, queryClient } from './query-client';
import { queryKeys } from './query-keys';

describe('queryClient (TanStack Query v5 Integration)', () => {
  it('should create QueryClient with financial caching defaults', () => {
    const client = createQueryClient();
    const defaultQueryOptions = client.getDefaultOptions().queries;
    const defaultMutationOptions = client.getDefaultOptions().mutations;

    expect(defaultQueryOptions?.staleTime).toBe(10_000);
    expect(defaultQueryOptions?.gcTime).toBe(300_000);
    expect(defaultQueryOptions?.refetchOnWindowFocus).toBe(true);
    expect(defaultMutationOptions?.retry).toBe(false);
  });

  it('should export a singleton queryClient instance', () => {
    expect(queryClient).toBeDefined();
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(10_000);
  });

  describe('shouldRetryQuery policy', () => {
    it('should not retry if failureCount >= 2', () => {
      expect(shouldRetryQuery(2, new Error('network failure'))).toBe(false);
      expect(shouldRetryQuery(3, new Error('server error'))).toBe(false);
    });

    it('should retry on network errors when failureCount < 2', () => {
      expect(shouldRetryQuery(0, new Error('Network error'))).toBe(true);
      expect(shouldRetryQuery(1, new TypeError('Failed to fetch'))).toBe(true);
    });

    it('should retry on HTTP 5xx server errors when failureCount < 2', () => {
      expect(shouldRetryQuery(0, { status: 500 })).toBe(true);
      expect(shouldRetryQuery(1, { status: 502 })).toBe(true);
      expect(shouldRetryQuery(0, { status: 503 })).toBe(true);
      expect(shouldRetryQuery(1, { response: { status: 504 } })).toBe(true);
    });

    it('should NOT retry on HTTP 4xx client/business errors', () => {
      expect(shouldRetryQuery(0, { status: 400 })).toBe(false);
      expect(shouldRetryQuery(0, { status: 401 })).toBe(false);
      expect(shouldRetryQuery(0, { status: 403 })).toBe(false);
      expect(shouldRetryQuery(0, { status: 404 })).toBe(false);
      expect(shouldRetryQuery(0, { status: 409 })).toBe(false);
      expect(shouldRetryQuery(0, { status: 422 })).toBe(false);
      expect(shouldRetryQuery(0, { status: 429 })).toBe(false);
      expect(shouldRetryQuery(0, { response: { status: 401 } })).toBe(false);
      expect(shouldRetryQuery(0, { statusCode: 403 })).toBe(false);
    });
  });

  describe('queryKeys factory', () => {
    it('generates consistent hierarchical keys for accounts', () => {
      expect(queryKeys.accounts.all).toEqual(['accounts']);
      expect(queryKeys.accounts.lists()).toEqual(['accounts', 'list']);
      expect(queryKeys.accounts.list('cust-123')).toEqual([
        'accounts',
        'list',
        { customerId: 'cust-123' },
      ]);
      expect(queryKeys.accounts.detail('acc-01')).toEqual(['accounts', 'detail', 'acc-01']);
      expect(queryKeys.accounts.balanceAt('acc-01', '2026-09-23T12:00:00Z')).toEqual([
        'accounts',
        'detail',
        'acc-01',
        'balance-at',
        '2026-09-23T12:00:00Z',
      ]);
    });

    it('generates consistent hierarchical keys for transactions', () => {
      expect(queryKeys.transactions.all).toEqual(['transactions']);
      expect(queryKeys.transactions.lists()).toEqual(['transactions', 'list']);
      expect(queryKeys.transactions.list('acc-01', { limit: 20 })).toEqual([
        'transactions',
        'list',
        { accountId: 'acc-01', limit: 20 },
      ]);
      expect(queryKeys.transactions.detail('tx-99')).toEqual(['transactions', 'detail', 'tx-99']);
    });

    it('generates consistent hierarchical keys for FX and beneficiaries', () => {
      expect(queryKeys.fx.rates()).toEqual(['fx', 'rates']);
      expect(queryKeys.fx.quote('USD', 'EUR', '1000.00')).toEqual([
        'fx',
        'quote',
        { fromCurrency: 'USD', toCurrency: 'EUR', amount: '1000.00' },
      ]);
      expect(queryKeys.beneficiaries.list('cust-1')).toEqual([
        'beneficiaries',
        'list',
        { customerId: 'cust-1' },
      ]);
    });
  });
});
