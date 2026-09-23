import { useQuery } from '@tanstack/react-query';
import { listCustomerAccounts, apiClient, type AccountResponse } from '@ble-frontend/api-client';
import { useAuth } from '../../../app/providers';
import { queryKeys } from '../../../app/query-keys';
import { mapAccountResponseToDomain, type Account } from '../types';

export interface UseAccountsOptions {
  enabled?: boolean;
}

export interface UseAccountsResult {
  accounts: Account[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * Custom React hook for fetching and caching customer accounts with TanStack Query.
 * Adheres to FR-CUST-ACC-01 and financial caching defaults.
 */
export function useAccounts(customerId?: string, options?: UseAccountsOptions): UseAccountsResult {
  const { user } = useAuth();
  const targetCustomerId = customerId || user?.id;

  const query = useQuery<Account[], Error>({
    queryKey: queryKeys.accounts.list(targetCustomerId),
    queryFn: async () => {
      if (!targetCustomerId) {
        return [];
      }

      try {
        // Primary Spring Boot endpoint: GET /api/v1/customers/{id}/accounts
        const response = await listCustomerAccounts({ id: targetCustomerId });
        return (response || []).map(mapAccountResponseToDomain);
      } catch (primaryError) {
        // Fallback endpoint: GET /api/v1/accounts?ownerRef={id}
        try {
          const fallback = await apiClient.get<AccountResponse[]>(
            `/api/v1/accounts?ownerRef=${encodeURIComponent(targetCustomerId)}`,
          );
          return (fallback || []).map(mapAccountResponseToDomain);
        } catch {
          throw primaryError instanceof Error ? primaryError : new Error('Failed to load accounts');
        }
      }
    },
    enabled: Boolean(targetCustomerId) && (options?.enabled ?? true),
  });

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
