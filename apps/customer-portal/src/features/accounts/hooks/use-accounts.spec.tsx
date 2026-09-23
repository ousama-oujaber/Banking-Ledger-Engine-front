import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import * as apiClientModule from '@ble-frontend/api-client';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import { AuthProvider } from '../../../app/providers';
import { useAccounts } from './use-accounts';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

describe('useAccounts hook', () => {
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
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();
    vi.restoreAllMocks();
  });

  const createWrapper = (token?: string) => {
    if (token) {
      AuthService.setToken(token);
    }
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider queryClient={queryClient}>{children}</AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );
    };
  };

  it('fetches and maps accounts for authenticated customer using primary endpoint', async () => {
    const token = createMockToken({
      sub: 'cust-uuid-42',
      roles: ['CUSTOMER'],
      preferred_username: 'alice',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const mockDtoList: apiClientModule.AccountResponse[] = [
      {
        id: 'acc-1',
        ownerId: 'cust-uuid-42',
        label: 'Checking Account',
        currency: 'EUR',
        type: 'CLASSIC',
        status: 'ACTIVE',
        derivedBalance: {
          amount: 1250.75,
          currency: 'EUR',
        },
        availableBalance: {
          amount: 1250.75,
          currency: 'EUR',
        },
        allowOverdraft: false,
        version: 1,
      },
    ];

    vi.spyOn(apiClientModule, 'listCustomerAccounts').mockImplementation(
      () =>
        Promise.resolve(
          mockDtoList,
        ) as unknown as apiClientModule.CancelablePromise<apiClientModule.ListCustomerAccountsResponse>,
    );

    const { result } = renderHook(() => useAccounts(), {
      wrapper: createWrapper(token),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.accounts).toHaveLength(1);

    const account = result.current.accounts[0];
    expect(account.id).toBe('acc-1');
    expect(account.derivedBalance.amount.toFixed()).toBe('1250.75');
    expect(account.derivedBalance.currency).toBe('EUR');
    expect(account.derivedBalance.format()).toBe('€1,250.75');
  });

  it('falls back to apiClient.get if primary listCustomerAccounts rejects', async () => {
    const token = createMockToken({
      sub: 'cust-uuid-42',
      roles: ['CUSTOMER'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const fallbackDtoList: apiClientModule.AccountResponse[] = [
      {
        id: 'acc-fallback',
        ownerId: 'cust-uuid-42',
        label: 'Fallback Account',
        currency: 'USD',
        type: 'SAVINGS',
        status: 'ACTIVE',
        derivedBalance: {
          amount: 500,
          currency: 'USD',
        },
      },
    ];

    vi.spyOn(apiClientModule, 'listCustomerAccounts').mockImplementation(
      () =>
        Promise.reject(
          new Error('Endpoint not found'),
        ) as unknown as apiClientModule.CancelablePromise<apiClientModule.ListCustomerAccountsResponse>,
    );
    vi.spyOn(apiClientModule.apiClient, 'get').mockResolvedValue(fallbackDtoList);

    const { result } = renderHook(() => useAccounts(), {
      wrapper: createWrapper(token),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.accounts[0].id).toBe('acc-fallback');
    expect(result.current.accounts[0].derivedBalance.currency).toBe('USD');
  });

  it('sets isError to true when both primary and fallback calls reject', async () => {
    const token = createMockToken({
      sub: 'cust-uuid-42',
      roles: ['CUSTOMER'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    vi.spyOn(apiClientModule, 'listCustomerAccounts').mockImplementation(
      () =>
        Promise.reject(
          new Error('Server unavailable'),
        ) as unknown as apiClientModule.CancelablePromise<apiClientModule.ListCustomerAccountsResponse>,
    );
    vi.spyOn(apiClientModule.apiClient, 'get').mockRejectedValue(new Error('Server unavailable'));

    const { result } = renderHook(() => useAccounts(), {
      wrapper: createWrapper(token),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeDefined();
    expect(result.current.accounts).toEqual([]);
  });

  it('remains idle and returns empty array when customer ID is absent and unauthenticated', () => {
    const { result } = renderHook(() => useAccounts(), {
      wrapper: createWrapper(),
    });

    expect(result.current.accounts).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
