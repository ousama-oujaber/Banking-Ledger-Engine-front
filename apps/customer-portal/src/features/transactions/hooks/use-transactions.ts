import { useQuery } from '@tanstack/react-query';
import {
  getAccountTransactions,
  apiClient,
  type TransactionResponse,
} from '@ble-frontend/api-client';
import { queryKeys } from '../../../app/query-keys';
import { mapTransactionResponseToDomain, type Transaction } from '../types';

export interface UseTransactionsOptions {
  accountId?: string;
  state?: string;
  limit?: number;
  enabled?: boolean;
}

export interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * Custom hook for fetching and caching customer transactions (S2-T4).
 */
export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsResult {
  const { accountId, state, limit = 20, enabled = true } = options;

  const query = useQuery<Transaction[], Error>({
    queryKey: queryKeys.transactions.list(accountId, { state, limit }),
    queryFn: async () => {
      try {
        if (accountId) {
          // Account-specific transactions endpoint
          try {
            const resp = await getAccountTransactions({
              id: accountId,
              state: state as any,
            });
            const list = Array.isArray(resp) ? resp : [resp];
            return list.map(mapTransactionResponseToDomain);
          } catch {
            const fallback = await apiClient.get<TransactionResponse[]>(
              `/api/v1/accounts/${encodeURIComponent(accountId)}/transactions`,
            );
            return (fallback || []).map(mapTransactionResponseToDomain);
          }
        } else {
          // Global / customer transaction feed
          const list = await apiClient.get<TransactionResponse[]>(
            `/api/v1/transactions${limit ? `?limit=${limit}` : ''}`,
          );
          return (list || []).map(mapTransactionResponseToDomain);
        }
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to load transaction history');
      }
    },
    enabled,
  });

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
