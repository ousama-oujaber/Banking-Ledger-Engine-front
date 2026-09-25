import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { Currency, Money } from '@ble-frontend/domain-types';
import * as apiClientModule from '@ble-frontend/api-client';
import { useTransferMutation, useDepositMutation, useWithdrawMutation } from './use-transfers';

describe('useTransfers mutation hooks (use-transfers.ts)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          retry: false,
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

  describe('useTransferMutation', () => {
    it('executes transfer and invalidates accounts and transactions query caches', async () => {
      const mockResponse: apiClientModule.TransactionResponse = {
        id: 'tx-created-1',
        type: 'TRANSFER',
        amount: { amount: 100, currency: 'EUR' },
        reference: 'TRF-TEST',
        state: 'SETTLED',
      };

      const transferSpy = vi
        .spyOn(apiClientModule, 'transfer')
        .mockResolvedValue(mockResponse as any);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useTransferMutation(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        command: {
          fromAccountId: 'acc-1',
          toAccountId: 'acc-2',
          amount: Money.from('100.00', Currency.EUR),
          reference: 'TRF-TEST',
          description: 'Test transfer',
        },
        idempotencyKey: 'custom-key-uuid-1',
      });

      expect(response.id).toBe('tx-created-1');
      expect(transferSpy).toHaveBeenCalledTimes(1);
      expect(transferSpy).toHaveBeenCalledWith({
        idempotencyKey: 'custom-key-uuid-1',
        requestBody: {
          fromAccountId: 'acc-1',
          toAccountId: 'acc-2',
          amount: { amount: 100, currency: 'EUR' },
          reference: 'TRF-TEST',
          description: 'Test transfer',
          beneficiaryId: undefined,
        },
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    });

    it('generates an idempotency key if not provided by caller', async () => {
      const mockResponse: apiClientModule.TransactionResponse = {
        id: 'tx-auto-key',
        state: 'SETTLED',
      };

      const transferSpy = vi
        .spyOn(apiClientModule, 'transfer')
        .mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useTransferMutation(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        command: {
          fromAccountId: 'acc-1',
          toAccountId: 'acc-2',
          amount: Money.from('25.00', Currency.EUR),
          reference: 'TRF-AUTO',
        },
      });

      expect(transferSpy).toHaveBeenCalledTimes(1);
      const callArgs = transferSpy.mock.calls[0][0];
      expect(callArgs.idempotencyKey).toBeTypeOf('string');
      expect(callArgs.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('retries on HTTP 409 Concurrent Modification using the SAME idempotency key', async () => {
      const conflictError = Object.assign(new Error('Optimistic lock failed'), {
        status: 409,
        code: 'CONCURRENT_MODIFICATION',
      });

      const mockSuccessResponse: apiClientModule.TransactionResponse = {
        id: 'tx-retry-success',
        state: 'SETTLED',
      };

      let attempt = 0;
      const transferSpy = vi.spyOn(apiClientModule, 'transfer').mockImplementation((() => {
        attempt++;
        if (attempt === 1) {
          return Promise.reject(conflictError) as any;
        }
        return Promise.resolve(mockSuccessResponse) as any;
      }) as any);

      const { result } = renderHook(() => useTransferMutation(), {
        wrapper: createWrapper(),
      });

      const fixedKey = 'fixed-uuid-409-test';
      const response = await result.current.mutateAsync({
        command: {
          fromAccountId: 'acc-1',
          toAccountId: 'acc-2',
          amount: Money.from('50.00', Currency.EUR),
          reference: 'TRF-RETRY',
        },
        idempotencyKey: fixedKey,
      });

      expect(response.id).toBe('tx-retry-success');
      expect(transferSpy).toHaveBeenCalledTimes(2);
      expect(transferSpy.mock.calls[0][0].idempotencyKey).toBe(fixedKey);
      expect(transferSpy.mock.calls[1][0].idempotencyKey).toBe(fixedKey);
    });
  });

  describe('useDepositMutation', () => {
    it('executes deposit and invalidates caches', async () => {
      const mockResponse: apiClientModule.TransactionResponse = {
        id: 'tx-dep-1',
        type: 'DEPOSIT',
        state: 'SETTLED',
      };

      const depositSpy = vi
        .spyOn(apiClientModule, 'deposit')
        .mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useDepositMutation(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        command: {
          accountId: 'acc-dep',
          amount: Money.from('200.00', Currency.EUR),
          reference: 'DEP-123',
          description: 'Payroll',
        },
        idempotencyKey: 'idemp-dep-1',
      });

      expect(response.id).toBe('tx-dep-1');
      expect(depositSpy).toHaveBeenCalledWith({
        id: 'acc-dep',
        idempotencyKey: 'idemp-dep-1',
        requestBody: {
          amount: { amount: 200, currency: 'EUR' },
          reference: 'DEP-123',
          description: 'Payroll',
        },
      });
    });
  });

  describe('useWithdrawMutation', () => {
    it('executes withdrawal and invalidates caches', async () => {
      const mockResponse: apiClientModule.TransactionResponse = {
        id: 'tx-wth-1',
        type: 'WITHDRAWAL',
        state: 'SETTLED',
      };

      const withdrawSpy = vi
        .spyOn(apiClientModule, 'withdraw')
        .mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useWithdrawMutation(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        command: {
          accountId: 'acc-wth',
          amount: Money.from('50.00', Currency.EUR),
          reference: 'WTH-123',
          description: 'ATM Cash',
        },
        idempotencyKey: 'idemp-wth-1',
      });

      expect(response.id).toBe('tx-wth-1');
      expect(withdrawSpy).toHaveBeenCalledWith({
        id: 'acc-wth',
        idempotencyKey: 'idemp-wth-1',
        requestBody: {
          amount: { amount: 50, currency: 'EUR' },
          reference: 'WTH-123',
          description: 'ATM Cash',
        },
      });
    });
  });
});
