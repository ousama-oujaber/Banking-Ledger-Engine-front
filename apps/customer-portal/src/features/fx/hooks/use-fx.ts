import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listActiveRates,
  requestQuote,
  executeTransfer,
  type TransactionResponse,
  type ApiError,
} from '@ble-frontend/api-client';
import { queryKeys } from '../../../app/query-keys';
import { generateIdempotencyKey } from '../../transfers/idempotency';
import {
  mapFxRateResponseToDomain,
  mapFxQuoteResponseToDomain,
  type FxRate,
  type FxQuote,
  type ExecuteFxTransferCommand,
} from '../types';

export interface UseFxRatesOptions {
  sourceCurrency?: string;
  targetCurrency?: string;
  enabled?: boolean;
}

export function useFxRates(options: UseFxRatesOptions = {}) {
  const { sourceCurrency, targetCurrency, enabled = true } = options;

  return useQuery<FxRate[], Error>({
    queryKey: ['fx', 'rates', { sourceCurrency, targetCurrency }],
    queryFn: async () => {
      try {
        const resp = await listActiveRates({
          sourceCurrency,
          targetCurrency,
        });
        return (resp || []).map(mapFxRateResponseToDomain);
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to retrieve active FX rates');
      }
    },
    enabled,
    staleTime: 10_000,
  });
}

export interface RequestQuoteParams {
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
}

export function useRequestQuoteMutation() {
  return useMutation<FxQuote, Error | ApiError, RequestQuoteParams>({
    mutationFn: async ({ sourceCurrency, targetCurrency, sourceAmount }) => {
      const resp = await requestQuote({
        requestBody: {
          sourceCurrency,
          targetCurrency,
          sourceAmount,
        },
      });
      return mapFxQuoteResponseToDomain(resp);
    },
  });
}

export interface ExecuteFxTransferMutationParams {
  command: ExecuteFxTransferCommand;
  idempotencyKey?: string;
}

export function useExecuteFxTransferMutation() {
  const queryClient = useQueryClient();

  return useMutation<TransactionResponse, Error | ApiError, ExecuteFxTransferMutationParams>({
    mutationFn: async ({ command, idempotencyKey = generateIdempotencyKey() }) => {
      return (await executeTransfer({
        idempotencyKey,
        requestBody: {
          quoteReference: command.quoteReference,
          sourceAccountId: command.sourceAccountId,
          destinationAccountId: command.destinationAccountId,
          reference: command.reference,
          description: command.description,
        },
      })) as TransactionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}
