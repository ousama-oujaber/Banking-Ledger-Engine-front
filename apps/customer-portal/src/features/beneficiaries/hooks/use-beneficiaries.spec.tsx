import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import * as apiClientModule from '@ble-frontend/api-client';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import { Currency } from '@ble-frontend/domain-types';
import { AuthProvider } from '../../../app/providers';
import {
  useBeneficiaries,
  useCreateBeneficiaryMutation,
  useDeleteBeneficiaryMutation,
} from './use-beneficiaries';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

describe('useBeneficiaries hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
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

  describe('useBeneficiaries query', () => {
    it('fetches beneficiaries and filters out REMOVED', async () => {
      const token = createMockToken({
        sub: 'cust-uuid-1',
        roles: ['CUSTOMER'],
        preferred_username: 'customer-user',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const listSpy = vi.spyOn(apiClientModule, 'list2').mockResolvedValue([
        {
          id: 'ben-1',
          ownerId: 'cust-uuid-1',
          destinationAccountId: 'acc-dest-1',
          name: 'Bob Supplier',
          currency: 'EUR',
          iban: 'FR7630006000011234567890189',
          status: 'ACTIVE',
        },
        {
          id: 'ben-2',
          ownerId: 'cust-uuid-1',
          destinationAccountId: 'acc-dest-2',
          name: 'Charlie Old',
          currency: 'USD',
          status: 'REMOVED',
        },
      ] as any);

      const { result } = renderHook(() => useBeneficiaries(), {
        wrapper: createWrapper(token),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(listSpy).toHaveBeenCalledWith({
        ownerId: 'cust-uuid-1',
        includeRemoved: false,
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].name).toBe('Bob Supplier');
      expect(result.current.data![0].status).toBe('ACTIVE');
    });

    it('handles non-array response gracefully', async () => {
      const token = createMockToken({
        sub: 'cust-uuid-1',
        roles: ['CUSTOMER'],
        preferred_username: 'customer-user',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      vi.spyOn(apiClientModule, 'list2').mockResolvedValue({
        id: 'ben-single',
        ownerId: 'cust-uuid-1',
        destinationAccountId: 'acc-1',
        name: 'Single Beneficiary',
        currency: 'USD',
        status: 'ACTIVE',
      } as any);

      const { result } = renderHook(() => useBeneficiaries(), {
        wrapper: createWrapper(token),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].id).toBe('ben-single');
    });

    it('is disabled when ownerId is missing', () => {
      const { result } = renderHook(() => useBeneficiaries(), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateBeneficiaryMutation', () => {
    it('creates beneficiary and invalidates query cache', async () => {
      const token = createMockToken({
        sub: 'cust-uuid-1',
        roles: ['CUSTOMER'],
        preferred_username: 'customer-user',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const createSpy = vi.spyOn(apiClientModule, 'create2').mockResolvedValue({
        id: 'ben-new-1',
        ownerId: 'cust-uuid-1',
        destinationAccountId: 'acc-999',
        name: 'Vendor X',
        currency: 'EUR',
        status: 'ACTIVE',
      } as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateBeneficiaryMutation(), {
        wrapper: createWrapper(token),
      });

      const res = await result.current.mutateAsync({
        name: 'Vendor X',
        destinationAccountId: 'acc-999',
        currency: Currency.EUR,
      });

      expect(createSpy).toHaveBeenCalledWith({
        requestBody: {
          ownerId: 'cust-uuid-1',
          destinationAccountId: 'acc-999',
          name: 'Vendor X',
          currency: 'EUR',
          iban: undefined,
          autoActivate: true,
        },
      });

      expect(res.id).toBe('ben-new-1');
      expect(res.name).toBe('Vendor X');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['beneficiaries'] });
    });
  });

  describe('useDeleteBeneficiaryMutation', () => {
    it('deletes beneficiary and invalidates query cache', async () => {
      const removeSpy = vi.spyOn(apiClientModule, 'remove').mockResolvedValue(undefined as any);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteBeneficiaryMutation(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync('ben-to-delete');

      expect(removeSpy).toHaveBeenCalledWith({ id: 'ben-to-delete' });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['beneficiaries'] });
    });
  });
});
