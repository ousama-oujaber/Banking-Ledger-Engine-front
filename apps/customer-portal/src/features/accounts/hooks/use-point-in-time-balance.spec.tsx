import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import * as apiClientModule from '@ble-frontend/api-client';
import { Currency } from '@ble-frontend/domain-types';
import { usePointInTimeBalance } from './use-point-in-time-balance';

describe('usePointInTimeBalance hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.restoreAllMocks();
  });

  const createWrapper = () => {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  };

  it('fetches historical balance using getBalance primary endpoint', async () => {
    const mockResponse: apiClientModule.AccountResponse = {
      id: 'acc-123',
      currency: 'EUR',
      derivedBalance: {
        amount: 2450.75,
        currency: 'EUR',
      },
      asOfDate: '2026-09-01T12:00:00Z',
    };

    vi.spyOn(apiClientModule, 'getBalance').mockImplementation(
      () =>
        Promise.resolve(
          mockResponse,
        ) as unknown as apiClientModule.CancelablePromise<apiClientModule.GetBalanceResponse>,
    );

    const { result } = renderHook(
      () =>
        usePointInTimeBalance({
          accountId: 'acc-123',
          asOf: '2026-09-01T12:00:00Z',
          currency: Currency.EUR,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.balance).toBeDefined();
    expect(result.current.balance?.amount.toFixed()).toBe('2450.75');
    expect(result.current.balance?.format()).toBe('€2,450.75');
    expect(result.current.asOf).toBe('2026-09-01T12:00:00Z');
  });

  it('falls back to /api/v1/accounts/{id}/balance-at when primary endpoint rejects', async () => {
    const fallbackResponse: apiClientModule.AccountResponse = {
      id: 'acc-fallback',
      currency: 'USD',
      derivedBalance: {
        amount: 1100,
        currency: 'USD',
      },
      asOfDate: '2026-08-15T00:00:00Z',
    };

    vi.spyOn(apiClientModule, 'getBalance').mockImplementation(
      () =>
        Promise.reject(
          new Error('Endpoint not found'),
        ) as unknown as apiClientModule.CancelablePromise<apiClientModule.GetBalanceResponse>,
    );
    vi.spyOn(apiClientModule.apiClient, 'get').mockResolvedValue(fallbackResponse);

    const { result } = renderHook(
      () =>
        usePointInTimeBalance({
          accountId: 'acc-fallback',
          asOf: '2026-08-15T00:00:00Z',
          currency: Currency.USD,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.balance?.amount.toFixed()).toBe('1100');
    expect(result.current.balance?.currency).toBe('USD');
  });

  it('sets isError to true when both primary and fallback calls reject', async () => {
    vi.spyOn(apiClientModule, 'getBalance').mockImplementation(
      () =>
        Promise.reject(
          new Error('Database unavailable'),
        ) as unknown as apiClientModule.CancelablePromise<apiClientModule.GetBalanceResponse>,
    );
    vi.spyOn(apiClientModule.apiClient, 'get').mockRejectedValue(new Error('Database unavailable'));

    const { result } = renderHook(
      () =>
        usePointInTimeBalance({
          accountId: 'acc-error',
          asOf: '2026-01-01T00:00:00Z',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.balance).toBeNull();
  });

  it('remains idle and does not query when asOf is not provided', () => {
    const { result } = renderHook(
      () =>
        usePointInTimeBalance({
          accountId: 'acc-123',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.balance).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
