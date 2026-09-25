import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import * as apiClientModule from '@ble-frontend/api-client';
import { Currency } from '@ble-frontend/domain-types';
import { useGenerateStatementMutation } from './use-statement';

describe('useGenerateStatementMutation hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    vi.restoreAllMocks();
  });

  const createWrapper = () => {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  };

  it('generates statement and returns mapped domain object', async () => {
    const mockDto: apiClientModule.AccountStatementResponse = {
      id: 'stmt-100',
      accountId: 'acc-1',
      fromDate: '2026-09-01',
      toDate: '2026-09-20',
      currency: 'USD',
      openingBalance: 200,
      closingBalance: 350,
      totalCredits: 150,
      totalDebits: 0,
      entryCount: 1,
      entries: [
        {
          entryId: 'e1',
          transactionId: 't1',
          creditAmount: 150,
          debitAmount: 0,
          runningBalance: 350,
          description: 'Payment',
        },
      ],
    };

    const spy = vi.spyOn(apiClientModule, 'generateStatement').mockResolvedValue(mockDto as any);

    const { result } = renderHook(() => useGenerateStatementMutation(), {
      wrapper: createWrapper(),
    });

    const statement = await result.current.mutateAsync({
      accountId: 'acc-1',
      fromDate: '2026-09-01',
      toDate: '2026-09-20',
    });

    expect(spy).toHaveBeenCalledWith({
      accountId: 'acc-1',
      requestBody: {
        fromDate: '2026-09-01',
        toDate: '2026-09-20',
      },
    });

    expect(statement.id).toBe('stmt-100');
    expect(statement.currency).toBe(Currency.USD);
    expect(statement.closingBalance.amount.toNumber()).toBe(350);
  });
});
