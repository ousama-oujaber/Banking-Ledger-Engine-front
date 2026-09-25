import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import * as apiClientModule from '@ble-frontend/api-client';
import { useFxRates, useRequestQuoteMutation, useExecuteFxTransferMutation } from './use-fx';

describe('use-fx hooks (use-fx.ts)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  const createWrapper = () => {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  };

  it('useFxRates fetches active rates', async () => {
    const mockRates: apiClientModule.FxRateResponse[] = [
      {
        id: 'r1',
        sourceCurrency: 'EUR',
        targetCurrency: 'USD',
        rate: 1.085,
      },
    ];

    vi.spyOn(apiClientModule, 'listActiveRates').mockResolvedValue(mockRates as any);

    const { result } = renderHook(() => useFxRates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].sourceCurrency).toBe('EUR');
    expect(result.current.data![0].rate).toBe(1.085);
  });

  it('useRequestQuoteMutation requests quote successfully', async () => {
    const mockQuote: apiClientModule.FxQuoteResponse = {
      id: 'q-101',
      quoteReference: 'QR-101',
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      sourceAmount: { amount: 100, currency: 'EUR' },
      targetAmount: { amount: 108.5, currency: 'USD' },
      exchangeRate: 1.085,
    };

    const quoteSpy = vi.spyOn(apiClientModule, 'requestQuote').mockResolvedValue(mockQuote as any);

    const { result } = renderHook(() => useRequestQuoteMutation(), {
      wrapper: createWrapper(),
    });

    const quote = await result.current.mutateAsync({
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      sourceAmount: 100,
    });

    expect(quote.quoteReference).toBe('QR-101');
    expect(quoteSpy).toHaveBeenCalledWith({
      requestBody: {
        sourceCurrency: 'EUR',
        targetCurrency: 'USD',
        sourceAmount: 100,
      },
    });
  });

  it('useExecuteFxTransferMutation executes transfer and invalidates query caches', async () => {
    const mockTx: apiClientModule.TransactionResponse = {
      id: 'tx-fx-settled',
      type: 'FX_TRANSFER',
      state: 'SETTLED',
    };

    const executeSpy = vi
      .spyOn(apiClientModule, 'executeTransfer')
      .mockResolvedValue(mockTx as any);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useExecuteFxTransferMutation(), {
      wrapper: createWrapper(),
    });

    const response = await result.current.mutateAsync({
      command: {
        quoteReference: 'QR-101',
        sourceAccountId: 'acc-eur-1',
        destinationAccountId: 'acc-usd-2',
        reference: 'FX-TRF-001',
        description: 'EUR to USD transfer',
      },
      idempotencyKey: 'fx-key-uuid-1',
    });

    expect(response.id).toBe('tx-fx-settled');
    expect(executeSpy).toHaveBeenCalledWith({
      idempotencyKey: 'fx-key-uuid-1',
      requestBody: {
        quoteReference: 'QR-101',
        sourceAccountId: 'acc-eur-1',
        destinationAccountId: 'acc-usd-2',
        reference: 'FX-TRF-001',
        description: 'EUR to USD transfer',
      },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] });
  });
});
