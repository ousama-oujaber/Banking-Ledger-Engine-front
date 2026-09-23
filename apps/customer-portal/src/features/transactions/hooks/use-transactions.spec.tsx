import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import * as apiClientModule from '@ble-frontend/api-client';
import { useTransactions } from './use-transactions';

describe('useTransactions hook', () => {
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

  it('fetches global transactions when accountId is not provided', async () => {
    const mockList: apiClientModule.TransactionResponse[] = [
      {
        id: 'tx-1',
        type: 'DEPOSIT',
        amount: { amount: 300, currency: 'EUR' },
        reference: 'REF-DEP-1',
        description: 'Direct Deposit',
        state: 'SETTLED',
        createdAt: '2026-09-20T10:00:00Z',
      },
    ];

    vi.spyOn(apiClientModule.apiClient, 'get').mockResolvedValue(mockList);

    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.transactions).toHaveLength(1);

    const tx = result.current.transactions[0];
    expect(tx.id).toBe('tx-1');
    expect(tx.amount.amount.toFixed()).toBe('300');
    expect(tx.amount.format()).toBe('€300.00');
  });

  it('fetches account-specific transactions when accountId is passed', async () => {
    const mockList: apiClientModule.TransactionResponse[] = [
      {
        id: 'tx-acc-specific',
        type: 'TRANSFER',
        amount: { amount: 50, currency: 'USD' },
        reference: 'REF-TRF-USD',
        description: 'P2P Transfer',
        state: 'POSTED',
        createdAt: '2026-09-21T12:00:00Z',
      },
    ];

    vi.spyOn(apiClientModule, 'getAccountTransactions').mockImplementation(
      () =>
        Promise.resolve(
          mockList as any,
        ) as unknown as apiClientModule.CancelablePromise<apiClientModule.GetAccountTransactionsResponse>,
    );

    const { result } = renderHook(
      () => useTransactions({ accountId: 'acc-123', state: 'POSTED' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].id).toBe('tx-acc-specific');
    expect(result.current.transactions[0].amount.currency).toBe('USD');
  });

  it('sets isError to true when request rejects', async () => {
    vi.spyOn(apiClientModule.apiClient, 'get').mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.transactions).toEqual([]);
  });

  it('handles loadMore pagination and hasMore status', async () => {
    const mockList: apiClientModule.TransactionResponse[] = Array.from({ length: 15 }, (_, i) => ({
      id: `tx-${i + 1}`,
      type: 'TRANSFER',
      amount: { amount: 10 * (i + 1), currency: 'EUR' },
      reference: `REF-${i + 1}`,
      description: `Tx ${i + 1}`,
      state: 'SETTLED',
      createdAt: '2026-09-22T00:00:00Z',
    }));

    vi.spyOn(apiClientModule.apiClient, 'get').mockResolvedValue(mockList);

    const { result } = renderHook(() => useTransactions({ pageSize: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.page).toBe(1);
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });
    expect(result.current.page).toBe(2);

    act(() => {
      result.current.resetPagination();
    });
    expect(result.current.page).toBe(1);
  });

  it('uses fallback endpoint when account-specific endpoint rejects', async () => {
    const mockFallbackList: apiClientModule.TransactionResponse[] = [
      {
        id: 'tx-fallback',
        type: 'TRANSFER',
        amount: { amount: 75, currency: 'EUR' },
        reference: 'REF-FB',
        description: 'Fallback tx',
        state: 'SETTLED',
        createdAt: '2026-09-22T00:00:00Z',
      },
    ];

    vi.spyOn(apiClientModule, 'getAccountTransactions').mockRejectedValue(
      new Error('Primary failed'),
    );
    vi.spyOn(apiClientModule.apiClient, 'get').mockResolvedValue(mockFallbackList);

    const { result } = renderHook(() => useTransactions({ accountId: 'acc-fallback-1' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].id).toBe('tx-fallback');
  });
});
