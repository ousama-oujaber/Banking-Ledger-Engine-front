import { useState, useCallback, useMemo } from 'react';
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
  pageSize?: number;
  initialPage?: number;
  enabled?: boolean;
}

export interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
  page: number;
  hasMore: boolean;
  loadMore: () => void;
  resetPagination: () => void;
}

/**
 * Custom hook for fetching and caching customer transactions with pagination (S2-T4).
 */
export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsResult {
  const { accountId, state, pageSize = 10, initialPage = 1, enabled = true } = options;
  const [page, setPage] = useState<number>(initialPage);

  const query = useQuery<Transaction[], Error>({
    queryKey: queryKeys.transactions.list(accountId, { state, page, pageSize }),
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
          const limit = page * pageSize;
          const list = await apiClient.get<TransactionResponse[]>(
            `/api/v1/transactions?limit=${limit}&offset=${(page - 1) * pageSize}`,
          );
          return (list || []).map(mapTransactionResponseToDomain);
        }
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to load transaction history');
      }
    },
    enabled,
  });

  const allTransactions = query.data ?? [];
  const visibleTransactions = useMemo(() => {
    // If client-side slicing or server limit:
    if (accountId) {
      return allTransactions.slice(0, page * pageSize);
    }
    return allTransactions;
  }, [allTransactions, page, pageSize, accountId]);

  const hasMore = useMemo(() => {
    if (accountId) {
      return allTransactions.length > page * pageSize;
    }
    return allTransactions.length >= page * pageSize;
  }, [allTransactions.length, page, pageSize, accountId]);

  const loadMore = useCallback(() => {
    if (hasMore && !query.isFetching) {
      setPage((prev) => prev + 1);
    }
  }, [hasMore, query.isFetching]);

  const resetPagination = useCallback(() => {
    setPage(initialPage);
  }, [initialPage]);

  return {
    transactions: visibleTransactions,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
    page,
    hasMore,
    loadMore,
    resetPagination,
  };
}
