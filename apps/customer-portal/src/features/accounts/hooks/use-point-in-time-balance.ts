import { useQuery } from '@tanstack/react-query';
import { getBalance, apiClient, type AccountResponse } from '@ble-frontend/api-client';
import { queryKeys } from '../../../app/query-keys';
import { extractMoney } from '../types';
import { Money, Currency } from '@ble-frontend/domain-types';

export interface UsePointInTimeBalanceOptions {
  accountId?: string;
  asOf?: string; // ISO 8601 string
  currency?: Currency | string;
  enabled?: boolean;
}

export interface PointInTimeBalanceResult {
  balance: Money | null;
  asOf: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Custom hook for querying historical / point-in-time derived balance.
 * Strictly adheres to FR-CUST-ACC-02 and BR-F01.
 */
export function usePointInTimeBalance({
  accountId,
  asOf,
  currency = Currency.EUR,
  enabled = true,
}: UsePointInTimeBalanceOptions): PointInTimeBalanceResult {
  const isQueryEnabled = Boolean(accountId && asOf && enabled);

  const query = useQuery<{ balance: Money; asOf: string }, Error>({
    queryKey: queryKeys.accounts.balanceAt(accountId ?? '', asOf ?? ''),
    queryFn: async () => {
      if (!accountId || !asOf) {
        throw new Error('Account ID and timestamp are required');
      }

      try {
        // Primary Spring Boot endpoint: GET /api/v1/accounts/{id}/balance?asOf={asOf}
        const resp = (await getBalance({
          id: accountId,
          asOf,
        })) as AccountResponse;

        const balDto = resp.derivedBalance || resp.balance || resp.ledgerBalance;
        const money = extractMoney(balDto, resp.currency || currency);
        return {
          balance: money,
          asOf: resp.asOfDate || resp.asOf || asOf,
        };
      } catch (primaryErr) {
        // Fallback endpoint: GET /api/v1/accounts/{id}/balance-at?timestamp={asOf}
        try {
          const fallback = await apiClient.get<AccountResponse>(
            `/api/v1/accounts/${encodeURIComponent(accountId)}/balance-at?timestamp=${encodeURIComponent(asOf)}`,
          );
          const balDto = fallback.derivedBalance || fallback.balance || fallback.ledgerBalance;
          const money = extractMoney(balDto, fallback.currency || currency);
          return {
            balance: money,
            asOf: fallback.asOfDate || fallback.asOf || asOf,
          };
        } catch {
          throw primaryErr instanceof Error
            ? primaryErr
            : new Error('Failed to retrieve point-in-time balance');
        }
      }
    },
    enabled: isQueryEnabled,
  });

  return {
    balance: query.data?.balance ?? null,
    asOf: query.data?.asOf ?? null,
    isLoading: query.isLoading && isQueryEnabled,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
